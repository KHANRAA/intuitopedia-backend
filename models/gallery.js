const mongoose = require('mongoose');
const Joi = require('joi');
const Schema = mongoose.Schema;
const chalk = require('chalk');

const gallerySchema = new Schema({
    imageUrl: {
        type: String,
        required: true,
    },
    deleteToken: {
        type: String,
        required: true,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    uploadBy: {
        type: Schema.Types.ObjectID,
        ref: 'User',
    },
}, {
    timestamps: true
});

const Gallery = mongoose.model('Gallery', gallerySchema, 'gallery');

validateGalleryImageUploadSchema = async (blogData) => {
    const schema = Joi.object({
        ids: Joi.array().items(Joi.string()).min(1).required(),
    });
    try {
        return await schema.validate(blogData);
    } catch (err) {
    }
};


exports.Gallery = Gallery;
exports.validateGalleryImageUploadSchema = validateGalleryImageUploadSchema;
