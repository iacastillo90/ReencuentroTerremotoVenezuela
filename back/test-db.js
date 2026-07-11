const mongoose = require('mongoose');

async function test() {
  await mongoose.connect('mongodb://127.0.0.1:27017/reencuentro');
  const persons = await mongoose.connection.collection('unifiedpersons').find({}).toArray();
  console.log('Total persons:', persons.length);
  persons.forEach(p => {
    console.log('Person ID:', p._id, 'Name:', p.name, 'ReportedBy:', p.metadata?.reportedBy);
  });
  process.exit(0);
}
test();
