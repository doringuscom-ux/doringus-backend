import mongoose from 'mongoose';

const CategorySchema = new mongoose.Schema({
    id: String, // Explicitly support the ID string from JSON
    name: String,
    label: String, // Ensure label field is present
    status: { type: String, default: 'Active' },
    image: String,
    // Flexible schema for other props
}, { strict: false, timestamps: true });

CategorySchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
    }
});

export default mongoose.model('Category', CategorySchema);
