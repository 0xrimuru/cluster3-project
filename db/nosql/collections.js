// db/nosql/collections.js - the MongoDB data model for LPA eComms (ICTPRG554).
// For each collection: the data types ($jsonSchema validator - MongoDB rejects documents that
// do not match), the indexes, the TTL (automatic expiry), the write concern (durability vs
// speed) and the partition (shard) key + sort key we would use if LPA grows to a sharded cluster.
//
// Why these collections are NoSQL and not MySQL tables:
//  - sessions:   short-lived, read on every request, expire on their own (TTL) - a key/value job
//  - activity:   append-only events, different details per event type, deleted after a year
//  - reviews:    flexible documents (tags list, optional fields, embedded author + votes)
//  - ratings:    a pre-computed summary per product, rebuilt by a change-stream trigger

const { ACTIVITY_TYPES } = require('../../config/nosql');
const str = (max, extra = {}) => Object.assign({ bsonType: 'string', maxLength: max }, extra);

module.exports = [
  {
    name: 'sessions',
    partitionKey: '_id (hashed) - spreads sessions evenly across shards',
    sortKey: 'none (always read one session by its key)',
    writeConcern: { w: 1 },           // fast: a lost session only means signing in again
    ttl: 'expiresAt (expireAfterSeconds: 0) - 2 h idle / 12 h maximum',
    validator: { $jsonSchema: {
      bsonType: 'object',
      required: ['_id', 'userId', 'cart', 'csrf', 'createdAt', 'lastSeen', 'expiresAt'],
      properties: {
        _id: str(64, { description: 'SHA-256 hash of the cookie token (the token itself is never stored)' }),
        userId: str(20, { description: 'lpa_users.lpa_user_ID in MySQL' }),
        cart: { bsonType: 'array', maxItems: 100, items: { bsonType: 'object', required: ['sku', 'qty'],
          properties: { sku: str(20), qty: { bsonType: 'int', minimum: 1, maximum: 100000 } } } },
        csrf: str(64),
        createdAt: { bsonType: 'date' }, lastSeen: { bsonType: 'date' }, expiresAt: { bsonType: 'date' },
        ipEnc: { bsonType: ['string', 'null'], description: 'AES-256-GCM encrypted IP address' },
        agent: str(200),
      },
    } },
    indexes: [
      { key: { expiresAt: 1 }, name: 'ttl_expiresAt', expireAfterSeconds: 0 },
      { key: { userId: 1 }, name: 'by_user' },          // sign out every session of a user
    ],
  },
  {
    name: 'activity_log',
    partitionKey: '{ type: 1, at: 1 } - events of one type stay together, ranged by time',
    sortKey: 'at (newest first)',
    writeConcern: { w: 1 },           // high write volume, one lost event is acceptable
    ttl: 'at (expireAfterSeconds: 31536000) - events are deleted after 365 days',
    validator: { $jsonSchema: {
      bsonType: 'object',
      required: ['at', 'type', 'message'],
      properties: {
        at: { bsonType: 'date' },
        type: { enum: ACTIVITY_TYPES },
        user: { bsonType: ['string', 'null'] },
        message: str(500),
        ipEnc: { bsonType: ['string', 'null'], description: 'AES-256-GCM encrypted IP address (personal information)' },
        meta: { bsonType: 'object' },
      },
    } },
    indexes: [
      { key: { at: 1 }, name: 'ttl_at', expireAfterSeconds: 365 * 24 * 3600 },
      { key: { type: 1, at: -1 }, name: 'type_at' },
      { key: { user: 1, at: -1 }, name: 'user_at' },
    ],
  },
  {
    name: 'product_reviews',
    partitionKey: '{ sku: "hashed" } - all reviews of a product on one shard',
    sortKey: 'createdAt (newest first) or helpful.count',
    writeConcern: { w: 'majority' },  // customer content: confirmed by the majority before "saved"
    preAndPostImages: true,           // so the trigger still knows the product when a review is deleted
    validator: { $jsonSchema: {
      bsonType: 'object',
      required: ['sku', 'author', 'rating', 'title', 'comment', 'status', 'helpful', 'createdAt', 'updatedAt'],
      properties: {
        sku: str(20, { pattern: '^[A-Z0-9-]{3,20}$' }),
        author: { bsonType: 'object', required: ['clientId', 'name'], properties: {
          userId: { bsonType: ['string', 'null'] }, clientId: str(20), name: str(101) } },
        rating: { bsonType: 'int', minimum: 1, maximum: 5 },
        title: str(80, { minLength: 3 }),
        comment: str(1000, { minLength: 10 }),
        tags: { bsonType: 'array', maxItems: 5, uniqueItems: true, items: str(30) },
        verified: { bsonType: 'bool', description: 'the author bought this product (checked in MySQL)' },
        status: { enum: ['published', 'hidden'] },
        helpful: { bsonType: 'object', required: ['count', 'voters'], properties: {
          count: { bsonType: 'int', minimum: 0 }, voters: { bsonType: 'array', items: { bsonType: 'string' } } } },
        createdAt: { bsonType: 'date' }, updatedAt: { bsonType: 'date' },
      },
    } },
    indexes: [
      { key: { sku: 1, 'author.clientId': 1 }, name: 'one_review_per_client', unique: true },
      { key: { sku: 1, status: 1, createdAt: -1 }, name: 'sku_status_newest' },
      { key: { status: 1, rating: 1, createdAt: -1 }, name: 'status_rating' },          // moderation: low ratings first
      { key: { title: 'text', comment: 'text', tags: 'text' }, name: 'text_search', weights: { title: 3, tags: 2, comment: 1 } },
    ],
  },
  {
    name: 'product_ratings',
    partitionKey: '_id (the SKU)',
    sortKey: 'none',
    writeConcern: { w: 1 },
    validator: { $jsonSchema: {
      bsonType: 'object',
      required: ['_id', 'avg', 'count', 'stars', 'updatedAt'],
      properties: {
        _id: str(20), avg: { bsonType: ['double', 'int'], minimum: 0, maximum: 5 }, count: { bsonType: 'int', minimum: 0 },
        stars: { bsonType: 'object' }, updatedAt: { bsonType: 'date' },
      },
    } },
    indexes: [],
  },
  {
    name: 'login_attempts',
    partitionKey: '{ key: "hashed" }',
    sortKey: 'at (newest first)',
    writeConcern: { w: 1 },
    ttl: 'at (expireAfterSeconds: 900) - failed sign-ins are forgotten after 15 minutes',
    validator: { $jsonSchema: {
      bsonType: 'object',
      required: ['key', 'at'],
      properties: {
        key: str(70, { pattern: '^(user|ip):', description: 'user:<user name> or ip:<SHA-256 of the IP> (no plain IP stored)' }),
        at: { bsonType: 'date' },
      },
    } },
    indexes: [
      { key: { at: 1 }, name: 'ttl_at', expireAfterSeconds: 900 },
      { key: { key: 1, at: -1 }, name: 'key_at' },
    ],
  },
  { name: 'system_state', validator: null, indexes: [], writeConcern: { w: 1 }, partitionKey: '_id', sortKey: 'none' },
];
