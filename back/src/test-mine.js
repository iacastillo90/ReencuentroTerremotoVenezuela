const mongoose = require('mongoose');
const { UserModel } = require('./models/user.model');
const { PersonModel } = require('./models/unified-person.model');

async function test() {
  await mongoose.connect('mongodb://127.0.0.1:27017/reencuentro');
  
  const user = await UserModel.create({
    email: 'test@example.com',
    name: 'Test',
    role: 'user',
    status: 'approved'
  });

  const p = await PersonModel.create({
    type: 'person',
    name: 'Test Report',
    normalizedName: 'test report',
    idHash: 'hash123',
    status: 'missing',
    lastSeen: {
      state: 'Caracas',
      date: new Date()
    },
    metadata: {
      source: 'manual',
      reportedBy: user._id
    }
  });
  
  console.log('Inserted Person reportedBy:', p.metadata.reportedBy);

  // query like the controller
  const userIdStr = user._id.toString();
  const found = await PersonModel.find({ 'metadata.reportedBy': userIdStr });
  
  console.log('Found with string userId:', found.length);
  
  // Cleanup
  await UserModel.deleteMany({});
  await PersonModel.deleteMany({});
  process.exit(0);
}
test();
