import mongoose from 'mongoose';

const InquirySchema = new mongoose.Schema({
    // Form fields
    fullName: String,
    email: String,
    phone: String,
    budget: String,
    message: String,

    // Relations
    influencerUsername: String,
    influencerName: String,

    // System
    status: { type: String, default: 'Pending' }
}, { strict: false, timestamps: true });

InquirySchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) { delete ret._id; }
});

export default mongoose.model('Inquiry', InquirySchema);
