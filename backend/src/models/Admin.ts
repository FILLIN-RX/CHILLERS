import mongoose, { Schema, Document } from 'mongoose';

export interface IAdmin extends Document {
  username: string;
  password: string;
  email?: string;
  _id: mongoose.Types.ObjectId;
}

const AdminSchema: Schema = new Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, sparse: true },
});

export default mongoose.model<IAdmin>('Admin', AdminSchema);
