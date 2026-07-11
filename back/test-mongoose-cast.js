const mongoose = require('mongoose');
const { Schema } = mongoose;
const schema = new Schema({
  metadata: { reportedBy: { type: Schema.Types.ObjectId } }
});
const Model = mongoose.model('TestCast', schema);

async function test() {
  await mongoose.connect('mongodb://127.0.0.1:27017/reencuentro');
  const idStr = new mongoose.Types.ObjectId().toString();
  await Model.create({ metadata: { reportedBy: idStr } });
  
  const found = await Model.find({ 'metadata.reportedBy': idStr });
  console.log('Found with string:', found.length);
  
  await Model.deleteMany({});
  process.exit(0);
}
test();
