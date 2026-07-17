const bcrypt = require('bcrypt');
async function test() {
  try {
    const hash = await bcrypt.hash('12345678', 10);
    console.log("Hash success:", hash);
  } catch (e) {
    console.error("Hash error:", e);
  }
}
test();
