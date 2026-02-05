import mongoose from 'mongoose';

const LocationSchema = new mongoose.Schema({
    id: String,
    name: String,
    label: String,
    status: { type: String, default: 'Active' },
}, { strict: false, timestamps: true });

LocationSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
    }
});

export default mongoose.model('Location', LocationSchema);
