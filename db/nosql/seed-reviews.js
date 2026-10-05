// Starting product reviews (inserted with insertMany by db/nosql/setup.js).
// Every author is an LPA client that bought the product on an invoice in MySQL (verified purchase).
const d = s => new Date(s + 'T10:00:00+10:00');
const r = (sku, clientId, name, rating, title, comment, tags, date, helpful = 0) => ({
  sku, author: { userId: null, clientId, name }, rating, title, comment, tags, verified: true,
  status: 'published', helpful: { count: helpful, voters: [] }, createdAt: d(date), updatedAt: d(date),
});
module.exports = [
  r('LPA-001', 'CL-001', 'Riverside College Library', 5, 'Students love it', 'Solid build and the hot-swap switches made repairs easy. We bought one for the help desk.', ['build quality', 'repairable'], '2026-08-06', 3),
  r('LPA-001', 'CL-002', 'DevWorks Pty Ltd', 4, 'Great keys, loud office', 'Typing feel is excellent. The blue switches are loud in an open office, so pick quieter ones.', ['typing feel', 'noisy'], '2026-08-08', 2),
  r('LPA-001', 'CL-005', 'Brisbane Coders Guild', 5, 'Best value mechanical', 'Compact layout and bright RGB at a fair price. The cable could be longer.', ['value', 'compact'], '2026-08-09'),
  r('LPA-002', 'CL-002', 'DevWorks Pty Ltd', 4, 'Quiet and comfortable', 'Silent clicks are great for meetings. Battery lasted about five weeks.', ['quiet', 'battery'], '2026-08-02', 1),
  r('LPA-002', 'CL-003', 'Logic Peripherals Australia', 3, 'Fine for everyday use', 'Does the job, but the scroll wheel feels a bit loose after a month.', ['scroll wheel'], '2026-08-05'),
  r('LPA-005', 'CL-003', 'Logic Peripherals Australia', 5, 'Sharp picture for calls', 'Auto-focus is quick and the dual microphones pick up the whole room.', ['video quality', 'microphone'], '2026-08-04', 4),
  r('LPA-006', 'CL-003', 'Logic Peripherals Australia', 4, 'Good noise cancelling', 'Blocks most of the office noise. Gets warm after a few hours.', ['noise cancelling', 'comfort'], '2026-08-03'),
  r('LPA-007', 'CL-004', 'Northgate High School', 4, 'Handy for the finance class', 'Students use it with laptops for spreadsheet work. Keys match the MK-87.', ['spreadsheets'], '2026-08-07'),
  r('LPA-007', 'CL-002', 'DevWorks Pty Ltd', 5, 'Perfect add-on', 'Pairs nicely with the MK-87 keyboard. USB-C cable included.', ['matches keyboard'], '2026-08-10', 1),
  r('LPA-008', 'CL-001', 'Riverside College Library', 2, 'One cable failed', 'Four of five work well, but one stopped giving a picture after two weeks.', ['reliability'], '2026-08-05'),
  r('LPA-008', 'CL-004', 'Northgate High School', 4, 'Works with our projectors', 'Gives 4K to the classroom projectors with no adapter. Braiding feels tough.', ['4K', 'durable'], '2026-08-06'),
  r('LPA-008', 'CL-002', 'DevWorks Pty Ltd', 5, 'Reliable 4K at 60Hz', 'No flicker on our 4K monitors. Two metres is the right length for desks.', ['4K'], '2026-08-02'),
];
