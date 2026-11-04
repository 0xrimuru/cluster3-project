// Review model - customer product reviews in MongoDB (collection: product_reviews).
// A review is one flexible document: rating, title, comment, a list of tags, the author
// (embedded), helpful votes (embedded list of voters) and a moderation status.
// Rules: only a customer who bought the product can review it (checked in MySQL), one review
// per client per product (unique index), authors edit/delete only their own review, staff can
// hide/show reviews. Validation happens here AND in MongoDB's $jsonSchema validator.
const { ObjectId } = require('mongodb');
const { col, C } = require('../../../config/nosql');
const Trigger = require('./RatingTrigger');

const reviews = () => col(C.reviews, { writeConcern: { w: 'majority' } });
const SORTS = { newest: { createdAt: -1 }, helpful: { 'helpful.count': -1, createdAt: -1 }, highest: { rating: -1, createdAt: -1 }, lowest: { rating: 1, createdAt: -1 } };
const oid = id => (ObjectId.isValid(String(id)) && String(id).length === 24 ? new ObjectId(String(id)) : null);

function toView(d, viewer) {
  if (!d) return null;
  const me = viewer && viewer.id;
  return {
    id: String(d._id), sku: d.sku, rating: d.rating, title: d.title, comment: d.comment, tags: d.tags || [],
    author: d.author.name, clientId: d.author.clientId, authorUserId: d.author.userId || null, verified: !!d.verified, status: d.status,
    helpful: d.helpful.count, votedByMe: !!me && d.helpful.voters.includes(me),
    mine: !!me && d.author.userId === me, createdAt: d.createdAt, updatedAt: d.updatedAt,
    edited: d.updatedAt - d.createdAt > 1000,
  };
}

// Server-side validation. Returns { errors, clean }.
function validate(body) {
  const errors = [];
  const rating = Number(body.rating);
  const title = String(body.title || '').trim();
  const comment = String(body.comment || '').trim();
  const tags = [...new Set(String(body.tags || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean))];
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) errors.push('Choose a rating from 1 to 5 stars.');
  if (title.length < 3 || title.length > 80) errors.push('Title must be 3 to 80 characters.');
  if (comment.length < 10 || comment.length > 1000) errors.push('Review must be 10 to 1000 characters.');
  if (tags.length > 5) errors.push('Use at most 5 tags.');
  if (tags.some(t => t.length > 30)) errors.push('Each tag must be 30 characters or fewer.');
  return { errors, clean: { rating, title, comment, tags } };
}

class Review {
  static get SORTS() { return Object.keys(SORTS); }
  static validate(body) { return validate(body); }

  // find - published reviews of one product (staff moderate hidden ones on /reviews). Uses index sku_status_newest.
  static async forProduct(sku, { viewer, sort = 'newest' } = {}) {
    const filter = { sku: String(sku).toUpperCase(), status: 'published' };
    const rows = await (await reviews()).find(filter).sort(SORTS[sort] || SORTS.newest).limit(100).toArray();
    return rows.map(d => toView(d, viewer));
  }

  static async get(id, viewer) {
    const _id = oid(id);
    return _id ? toView(await (await reviews()).findOne({ _id }), viewer) : null;
  }

  // findOne - this client's review of the product, if any.
  static async mine(sku, clientId, viewer) {
    return toView(await (await reviews()).findOne({ sku: String(sku).toUpperCase(), 'author.clientId': clientId }), viewer);
  }

  // insertOne. Returns { review } or { errors }.
  static async create({ user, customer, sku, data }) {
    const now = new Date();
    const doc = {
      sku: String(sku).toUpperCase(), author: { userId: user.id, clientId: customer.code, name: `${customer.firstName} ${customer.lastName}` },
      rating: data.rating, title: data.title, comment: data.comment, tags: data.tags, verified: true,
      status: 'published', helpful: { count: 0, voters: [] }, createdAt: now, updatedAt: now,
    };
    try {
      const r = await (await reviews()).insertOne(doc);
      doc._id = r.insertedId;
    } catch (err) {
      if (err.code === 11000) return { errors: ['You have already reviewed this product - edit your review instead.'] };
      if (err.code === 121) return { errors: ['The review was rejected by the database validation rules.'] };
      throw err;
    }
    await Trigger.afterWrite({ operationType: 'insert', fullDocument: doc });
    return { review: toView(doc, user) };
  }

  // updateOne - authors change only their own review.
  static async update(id, user, data) {
    const _id = oid(id);
    if (!_id) return null;
    const r = await (await reviews()).findOneAndUpdate({ _id, 'author.userId': user.id },
      { $set: { rating: data.rating, title: data.title, comment: data.comment, tags: data.tags, updatedAt: new Date() } }, { returnDocument: 'after' });
    if (r) await Trigger.afterWrite({ operationType: 'update', fullDocument: r });
    return toView(r, user);
  }

  // deleteOne - the author, or an administrator.
  static async remove(id, user) {
    const _id = oid(id);
    if (!_id) return false;
    // the controller already checked the policy; the filter repeats the ownership rule as a safety net
    const filter = require('../../Security/policy').can(user, 'reviews.delete_any') ? { _id } : { _id, 'author.userId': user.id };
    const r = await (await reviews()).findOneAndDelete(filter);
    if (r) await Trigger.afterWrite({ operationType: 'delete', fullDocumentBeforeChange: r });
    return !!r;
  }

  // updateOne with $inc + $addToSet - one "helpful" vote per person, not on your own review.
  // The filter makes it atomic: two clicks at once still count once.
  static async vote(id, user) {
    const _id = oid(id);
    if (!_id) return { ok: false, error: 'Review not found.' };
    const r = await (await reviews()).updateOne(
      { _id, status: 'published', 'author.userId': { $ne: user.id }, 'helpful.voters': { $ne: user.id } },
      { $addToSet: { 'helpful.voters': user.id }, $inc: { 'helpful.count': 1 } });
    if (r.modifiedCount === 1) return { ok: true };
    return { ok: false, error: 'You can vote once per review, and not on your own review.' };
  }

  // Staff moderation: hide / publish (updateOne).
  static async setStatus(id, status) {
    const _id = oid(id);
    if (!_id || !['published', 'hidden'].includes(status)) return null;
    const r = await (await reviews()).findOneAndUpdate({ _id }, { $set: { status } }, { returnDocument: 'after' });
    if (r) await Trigger.afterWrite({ operationType: 'update', fullDocument: r });
    return toView(r);
  }

  // Staff search: text index ($text) and/or filters on status and rating (index status_rating).
  static async search({ q, status, maxRating, sku } = {}) {
    const filter = {};
    if (q) filter.$text = { $search: String(q).slice(0, 100) };
    if (['published', 'hidden'].includes(status)) filter.status = status;
    if (Number(maxRating) >= 1 && Number(maxRating) <= 5) filter.rating = { $lte: Number(maxRating) };
    if (sku) filter.sku = String(sku).toUpperCase();
    const cursor = (await reviews()).find(filter, q ? { projection: { score: { $meta: 'textScore' } } } : {});
    cursor.sort(q ? { score: { $meta: 'textScore' } } : { createdAt: -1 }).limit(200);
    return (await cursor.toArray()).map(d => toView(d));
  }

  // Rating summaries for several products at once (product_ratings, by _id).
  static async summaries(skus) {
    const list = [...new Set((skus || []).map(s => String(s).toUpperCase()))];
    if (!list.length) return {};
    const rows = await (await col(C.ratings)).find({ _id: { $in: list } }).toArray();
    return Object.fromEntries(rows.map(r => [r._id, { avg: r.avg, count: r.count, stars: r.stars }]));
  }
  static async summary(sku) { return (await Review.summaries([sku]))[String(sku).toUpperCase()] || null; }
}

module.exports = Review;
