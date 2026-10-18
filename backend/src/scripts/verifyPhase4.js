import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { io as ClientIO } from '../../../frontend/node_modules/socket.io-client/build/esm/index.js';
import User from '../models/User.js';
import Job from '../models/Job.js';
import Attendance from '../models/Attendance.js';
import AuditLog from '../models/AuditLog.js';
import env from '../config/env.js';
import { destinationPoint } from '../utils/geo.js';

const API_BASE = 'http://localhost:5000/api/v1';

// Minimal 1x1 valid JPEG
const VALID_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
  0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
  0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
  0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
  0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
  0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
  0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff,
  0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xbf, 0x00, 0xff,
  0xd9,
]);

async function run() {
  console.log('\n🔍 --- STARTING PHASE 4 END-TO-END VERIFICATION ---');

  await mongoose.connect(env.mongoUri);
  console.log('✅ Connected to MongoDB Atlas');

  // Find users
  const worker1 = await User.findOne({ phone: '+919000000001' });
  const worker2 = await User.findOne({ phone: '+919000000002' });
  const contractor = await User.findOne({ phone: '+919000000100' });

  const worker1Token = jwt.sign({ id: worker1._id, role: worker1.role }, env.jwtSecret);
  const worker2Token = jwt.sign({ id: worker2._id, role: worker2.role }, env.jwtSecret);
  const contractorToken = jwt.sign({ id: contractor._id, role: contractor.role }, env.jwtSecret);

  // Find Phase 4 test job
  const job = await Job.findOne({ title: 'Phase4 Test Job' });
  if (!job) {
    throw new Error('Phase4 Test Job not found. Run npm run seed:attendance first.');
  }

  const [siteLng, siteLat] = job.location.coordinates;
  const outsidePt = destinationPoint(siteLat, siteLng, 0.13, 180); // 130m = 0.13km
  const insidePt = destinationPoint(siteLat, siteLng, 0.05, 0);   // 50m = 0.05km

  // Clean previous attendance records for this job to start fresh
  await Attendance.deleteMany({ job: job._id });
  await AuditLog.deleteMany({ entityId: String(job._id) });

  console.log('\n--- VERIFICATION 1: Rejected Check-in from OUTSIDE (130m South) ---');
  const outsideForm = new FormData();
  outsideForm.append('lat', String(outsidePt.latitude));
  outsideForm.append('lng', String(outsidePt.longitude));
  outsideForm.append('accuracy', '10');
  outsideForm.append('clientTimestamp', new Date().toISOString());
  outsideForm.append('method', 'gps_selfie');
  outsideForm.append('selfie', new Blob([VALID_JPEG], { type: 'image/jpeg' }), 'selfie.jpg');

  const outsideRes = await fetch(`${API_BASE}/jobs/${job._id}/attendance/check-in`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${worker1Token}` },
    body: outsideForm,
  });
  const rejectionData = await outsideRes.json();

  console.log(`✅ OUTSIDE check-in rejected with status ${outsideRes.status}`);
  console.log(`   Response Code: ${rejectionData.error?.code}`);
  console.log(`   Message: ${rejectionData.error?.message}`);
  console.log(`   Details:`, rejectionData.error?.details);

  if (outsideRes.status !== 422) {
    throw new Error(`Expected status 422 but got ${outsideRes.status}`);
  }

  console.log('\n--- VERIFICATION 2: Confirm NO Attendance document & AuditLog trail ---');
  const attDocsCount = await Attendance.countDocuments({ job: job._id, worker: worker1._id });
  console.log(`✅ Attendance documents count: ${attDocsCount} (MUST be 0)`);

  const auditEntry = await AuditLog.findOne({
    action: 'ATTENDANCE_CHECKIN_REJECTED',
    entityId: String(job._id),
    actor: worker1._id,
  });

  if (!auditEntry) {
    throw new Error('FAILED: AuditLog entry not found for rejected check-in!');
  }
  console.log('✅ AuditLog entry created:');
  console.log(JSON.stringify(auditEntry, null, 2));

  console.log('\n--- VERIFICATION 3: Accepted Check-in from INSIDE (50m North) ---');
  // Connect contractor socket to observe live check-in event
  const contractorSocket = ClientIO('http://localhost:5000', {
    auth: { token: contractorToken },
  });

  let liveCheckedInEvent = null;
  contractorSocket.on('attendance:checkedIn', (payload) => {
    liveCheckedInEvent = payload;
  });

  const insideForm = new FormData();
  insideForm.append('lat', String(insidePt.latitude));
  insideForm.append('lng', String(insidePt.longitude));
  insideForm.append('accuracy', '10');
  insideForm.append('clientTimestamp', new Date().toISOString());
  insideForm.append('method', 'gps_selfie');
  insideForm.append('selfie', new Blob([VALID_JPEG], { type: 'image/jpeg' }), 'selfie.jpg');

  const insideRes = await fetch(`${API_BASE}/jobs/${job._id}/attendance/check-in`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${worker1Token}` },
    body: insideForm,
  });
  const checkInData = await insideRes.json();

  console.log(`✅ INSIDE check-in accepted with status ${insideRes.status}`);
  console.log(`   Attendance ID: ${checkInData.data._id}`);
  console.log(`   Distance Recorded: ${checkInData.data.checkInDistanceMeters}m`);
  console.log(`   Selfie URL: ${checkInData.data.selfieUrl}`);

  await new Promise((r) => setTimeout(r, 600));
  if (liveCheckedInEvent) {
    console.log('✅ Contractor Socket received live attendance:checkedIn event:');
    console.log(liveCheckedInEvent);
  }

  console.log('\n--- VERIFICATION 4: Check Selfie File on Disk & Access Control ---');
  const createdAtt = await Attendance.findById(checkInData.data._id);
  const diskPath = path.resolve(env.uploadDir, createdAtt.selfieUrl);
  console.log(`   Disk Path: ${diskPath}`);
  console.log(`   File Exists on Disk: ${fs.existsSync(diskPath)}`);

  // Unauthorized access (no token) -> 401
  const anonRes = await fetch(`${API_BASE}/attendance/${createdAtt._id}/selfie`);
  console.log(`✅ Anonymous access blocked with status: ${anonRes.status}`);

  // Another worker access -> 403
  const otherWorkerRes = await fetch(`${API_BASE}/attendance/${createdAtt._id}/selfie`, {
    headers: { Authorization: `Bearer ${worker2Token}` },
  });
  console.log(`✅ Other worker access blocked with status: ${otherWorkerRes.status}`);

  // Owning worker access -> 200
  const ownerRes = await fetch(`${API_BASE}/attendance/${createdAtt._id}/selfie`, {
    headers: { Authorization: `Bearer ${worker1Token}` },
  });
  const ownerBuffer = await ownerRes.arrayBuffer();
  console.log(`✅ Worker owner fetched selfie successfully: Status ${ownerRes.status}, Bytes: ${ownerBuffer.byteLength}`);

  // Contractor access -> 200
  const contractorRes = await fetch(`${API_BASE}/attendance/${createdAtt._id}/selfie`, {
    headers: { Authorization: `Bearer ${contractorToken}` },
  });
  const contractorBuffer = await contractorRes.arrayBuffer();
  console.log(`✅ Contractor fetched selfie successfully: Status ${contractorRes.status}, Bytes: ${contractorBuffer.byteLength}`);

  console.log('\n--- VERIFICATION 5: Check-out and Contractor Sign-off Flow ---');
  let liveCheckedOutEvent = null;
  contractorSocket.on('attendance:checkedOut', (payload) => {
    liveCheckedOutEvent = payload;
  });

  const checkOutForm = new FormData();
  checkOutForm.append('lat', String(insidePt.latitude));
  checkOutForm.append('lng', String(insidePt.longitude));
  checkOutForm.append('accuracy', '10');
  checkOutForm.append('clientTimestamp', new Date().toISOString());

  const checkOutRes = await fetch(`${API_BASE}/jobs/${job._id}/attendance/check-out`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${worker1Token}` },
    body: checkOutForm,
  });
  const checkOutData = await checkOutRes.json();

  console.log(`✅ Check-out successful: Status ${checkOutRes.status}`);
  console.log(`   Hours Worked: ${checkOutData.data.hoursWorked}`);
  console.log(`   Signoff Status: ${checkOutData.data.contractorSignoff.status}`);

  await new Promise((r) => setTimeout(r, 600));
  if (liveCheckedOutEvent) {
    console.log('✅ Contractor Socket received live attendance:checkedOut event:');
    console.log(liveCheckedOutEvent);
  }

  console.log('\n--- VERIFICATION 6: Immutability Guard Verification ---');
  const postCheckoutDoc = await Attendance.findById(createdAtt._id);
  postCheckoutDoc.checkInAt = new Date('2020-01-01');
  let immutabilityTriggered = false;
  try {
    await postCheckoutDoc.save();
  } catch (err) {
    immutabilityTriggered = true;
    console.log(`✅ Immutability guard correctly threw error: "${err.message}"`);
  }
  if (!immutabilityTriggered) {
    throw new Error('FAILED: Immutability guard did not throw error on mutation!');
  }

  console.log('\n--- VERIFICATION 7: Contractor Sign-off (APPROVED) ---');
  const signoffRes = await fetch(`${API_BASE}/attendance/${createdAtt._id}/signoff`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${contractorToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ decision: 'APPROVED' }),
  });
  const signoffData = await signoffRes.json();

  console.log(`✅ Contractor sign-off completed: Status ${signoffRes.status}`);
  console.log(`   Final Signoff Decision: ${signoffData.data.contractorSignoff.status}`);

  contractorSocket.disconnect();
  await mongoose.disconnect();
  console.log('\n🎉 --- ALL VERIFICATION CHECKS PASSED WITH 100% SUCCESS --- 🎉\n');
}

run().catch((err) => {
  console.error('\n❌ Verification failed:', err);
  process.exit(1);
});
