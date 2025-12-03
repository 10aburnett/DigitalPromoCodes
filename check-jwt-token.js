const { verify } = require('jsonwebtoken');

// This would normally come from cookies, but for debugging let's see what format JWT should have
// TODO: Update fallback secret when new brand is finalised (env var AUTH_SECRET should be used in production)
const jwtSecret = process.env.AUTH_SECRET || "site-dev-secret-key";

console.log('=== JWT TOKEN DEBUGGING ===');
console.log('JWT Secret:', jwtSecret);
console.log('\nExpected admin users in database:');
console.log('1. cmd6ig87z00006tphe0lhjb3k (admin@example.com)');
console.log('2. admin-1754410423863 (alexburnett21@icloud.com)');

console.log('\nTo test JWT token:');
console.log('1. Go to browser dev tools');
console.log('2. Go to Application/Storage > Cookies > [your-domain]');
console.log('3. Find "admin-token" cookie value');
console.log('4. Paste it here to decode:');

// If you want to test with a token, uncomment and add your token:
// const testToken = "YOUR_ACTUAL_TOKEN_FROM_BROWSER_COOKIE";
// try {
//   const decoded = verify(testToken, jwtSecret);
//   console.log('Decoded token:', decoded);
// } catch (error) {
//   console.log('Token decode error:', error.message);
// }