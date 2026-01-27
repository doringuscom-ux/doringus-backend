const mongoose = require('mongoose');

const CampaignSchema = new mongoose.Schema({
    name: String,
    status: { type: String, default: 'Active' },
    // Flexible
}, { strict: false, timestamps: true });

CampaignSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
    }
});

module.exports = mongoose.model('Campaign', CampaignSchema);
