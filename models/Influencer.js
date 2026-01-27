const mongoose = require('mongoose');

const InfluencerSchema = new mongoose.Schema({
    // Auth & Identity
    username: { type: String, required: true, unique: true },
    email: { type: String, unique: true },
    password: { type: String, required: true },
    name: { type: String },

    // Status
    status: { type: String, default: 'Pending' },
    joinedDate: { type: String },
    isFeatured: { type: Boolean, default: false },

    // Profile
    profileImage: String,
    category: String,
    rating: String,
    location: String,
    bio: String,
    skills: [String],

    // Stats
    followers: String,
    engagement: String,

    // Links
    instagramLink: String,
    youtubeLink: String,
    videoUrl: String,

    // Pricing
    pricePerReel: String,
    price: String,
    collaborationPrice: String,
    responseTime: String,

    // Content
    gallery: [String],
    youtubeVideos: [String],
    instagramReels: [String]
}, { strict: false, timestamps: true });

InfluencerSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        delete ret._id;
        delete ret.password;
    }
});

module.exports = mongoose.model('Influencer', InfluencerSchema);
