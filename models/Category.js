const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
    name: String,
    status: { type: String, default: 'Active' },
    image: String, // Ensure image field is present if used
    // Flexible schema for other props
}, { strict: false, timestamps: true });

CategorySchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
    }
});

module.exports = mongoose.model('Category', CategorySchema);
