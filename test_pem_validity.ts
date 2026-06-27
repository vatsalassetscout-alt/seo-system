import { createPrivateKey, createSign } from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
if (!saJson) {
  console.log("No GOOGLE_SERVICE_ACCOUNT_KEY");
  process.exit(1);
}

try {
  const sa = JSON.parse(saJson.trim());
  const pk = sa.private_key;
  
  console.log("Attempting to load private key into Node.js crypto...");
  const privateKeyObj = createPrivateKey(pk);
  console.log("✅ Private key loaded successfully!");
  
  // Test signing
  const sign = createSign('SHA256');
  sign.update('test data');
  const signature = sign.sign(privateKeyObj, 'base64');
  console.log("✅ Successfully signed test data! Signature length:", signature.length);
} catch (err: any) {
  console.error("❌ Failed to load or sign with private key:", err.message);
  console.error(err.stack);
}
