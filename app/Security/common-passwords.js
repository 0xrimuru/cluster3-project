// The most common passwords (from public breach lists). A password on this list - or one that
// contains the user name - is refused even if it has 8+ characters, a letter and a number.
module.exports = new Set([
  'password', 'password1', 'password12', 'password123', 'password1234', 'passw0rd', 'p@ssw0rd', 'p@ssword1',
  '12345678', '123456789', '1234567890', '87654321', '11111111', '00000000', '12341234', '11223344',
  'qwerty12', 'qwerty123', 'qwertyui', 'qwerty1234', '1q2w3e4r', '1q2w3e4r5t', 'q1w2e3r4', 'zaq12wsx', 'asdf1234', 'asdfgh12',
  'abc12345', 'abcd1234', 'abcdefg1', 'a1b2c3d4', 'iloveyou1', 'letmein1', 'welcome1', 'welcome123', 'monkey123',
  'dragon123', 'football1', 'baseball1', 'sunshine1', 'princess1', 'superman1', 'trustno1', 'master123', 'shadow123',
  'admin123', 'admin1234', 'administrator1', 'root1234', 'changeme1', 'default1', 'secret123', 'test1234', 'testing123',
  'login123', 'user1234', 'guest123', 'summer2026', 'winter2026', 'spring2026', 'autumn2026', 'australia1', 'brisbane1',
  'lpa12345', 'lpa2026', 'logic123', 'peripherals1', 'company1', 'computer1', 'keyboard1', 'mouse123', 'monitor1',
]);
