const express = require('express');
const router = express.Router();
const chalk = require('chalk');
const fs = require('fs');
const mongoose = require('mongoose');
const path = require('path');
const _ = require('lodash');
const {v4: uuidv4} = require('uuid');
const {Faq, validateFaqSchema} = require('../models/faq');
const {User} = require('../models/user');
const {TempUploads, validateTempUploadDeleteSchema} = require('../models/upload');
const {Storage} = require('@google-cloud/storage');
const validateObjectId = require('../middleware/validateObjectId');
const {Gallery} = require("../models/gallery");
const {isEmpty} = require("underscore");
const {error} = require("winston");
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const {date} = require("joi");

const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minutes
    max: 15,
    validate: {xForwardedForHeader: false},
    message: {
        status: 429,
        data: {
            type: 'RATE_LIMIT',
            message: 'Rate Exceeded, please try again later...',
            title: 'Too Many requests'
        }
    }
});


router.get('/', apiLimiter, (req, res, next) => {
    return res.json({status: 200, data: 'Hi  from blog Controller'});
});
router.get('/all', async (req, res, next) => {
    const token = req.header('tuitopediatoken');
    let user;
    let dbUser;
    if (token) {
        user = await jwt.verify(token, `${process.env.SECRET_KEY}`);
        dbUser = await User.findById(user._id);
    }
    const monthNames = ["Jan", "Feb", "Mar", "Apr",
        "May", "Jun", "Jul", "Aug",
        "Sep", "Oct", "Nov", "Dec"];
    const faqs = await Faq.aggregate([
        {
            $lookup: {
                from: 'users',
                foreignField: '_id',
                localField: 'createdBy',
                as: 'createdBy',
            },

        }, {
            $project: {
                id: '$_id',
                _id: 0,
                title: 1,
                imageUrl: 1,
                isActive: 1,
                content: 1,
                createdAt: {$convert: {input: '$createdAt', to: 'date'}},
                category: 1,
            }
        },
        {
            $sort: {
                createdAt: -1
            }
        }
    ]);
    let faqResults = [...faqs];
    faqResults.map(faq => {
        faq.createdAt = new Date(faq.createdAt).getDate() + 'th ' + monthNames[new Date(faq.createdAt).getMonth()];
    });
    if (!dbUser || !dbUser.role === 'admin') {
        faqResults = faqResults.filter((eachFaq) => eachFaq.isActive === true);
    }
    return sendSuccessResponse(res, faqResults);

});


router.post('/add', apiLimiter, auth, admin, async (req, res, next) => {
    const user = req.user;
    const faqData = req.body.data;
    const joiValidate = await validateFaqSchema(faqData);
    if (joiValidate.error) return sendErrorResponse(res, {
        type: 'validation',
        message: joiValidate.error.details[0].message
    });
    // const tempUpload = await TempUploads.findById(req.body.imageUrl);
    let uploadedImage = '';
    const imageIds = [faqData.imageId];

    await Promise.all(imageIds.map(async image => {
        console.log(chalk.red('first call'));
        const tempUploadByImage = await TempUploads.findById(image);
        if (tempUploadByImage) {
            const newImage = new Gallery({
                uploadBy: user,
                imageUrl: tempUploadByImage.publicUrl,
                deleteToken: tempUploadByImage.fileName,
            });
            await newImage.save().then(async (imageData) => {
                console.log(chalk.blue(imageData));
                uploadedImage = imageData.imageUrl;
            }).then(async () => {
                await TempUploads.findByIdAndDelete(image);
            });
        }

    }));


    if (!uploadedImage || uploadedImage === '') return sendErrorResponse(res, {
        type: 'imageId',
        message: 'Image Not found ...'
    });
    console.log(uploadedImage);
    const faq = new Faq({
        title: faqData.title,
        createdBy: user,
        content: faqData.content,
        imageUrl: uploadedImage,
        category: faqData.category,
    });
    const faqSavedData = await faq.save().catch((error) => {
        console.log(chalk.red('here ..'));
        console.log(chalk.red(uploadedImage));
        next(error);
    })
    return sendSuccessResponse(res, {type: 'SUCCESS', data: faqSavedData});


});


router.put('/update', apiLimiter, auth, admin, async (req, res, next) => {
    const user = req.user;
    const faqData = req.body.data;
    const joiValidate = await validateFaqUpdateSchema(faqData);
    if (joiValidate.error) return sendErrorResponse(res, {
        type: 'validation',
        message: joiValidate.error.details[0].message
    });

    const dbFaq = await Faq.findById(faqData.id);

    if (!dbFaq) return sendErrorResponse(res, {
        type: 'NOT_FOUND',
        message: 'The FAQ is not available'
    });

    const faqUpdateData = {
        title: faqData.title,
        createdBy: user,
        content: faqData.content,
        category: faqData.category,
    };
    if (faqData.isActive !== undefined) {
        faqUpdateData.isActive = faqData.isActive;
    }
    // const tempUpload = await TempUploads.findById(req.body.imageUrl);
    let uploadedImage = '';
    if (faqData.imageId && faqData.imageId.length === 24) {
        const imageIds = [faqData.imageId];

        await Promise.all(imageIds.map(async image => {
            console.log(chalk.red('Updating Image'));
            const tempUploadByImage = await TempUploads.findById(image);
            if (tempUploadByImage) {
                const newImage = new Gallery({
                    uploadBy: user,
                    imageUrl: tempUploadByImage.publicUrl,
                    deleteToken: tempUploadByImage.fileName,
                });
                await newImage.save().then(async (imageData) => {
                    console.log(chalk.blue(imageData));
                    uploadedImage = imageData.imageUrl;
                }).then(async () => {
                    await TempUploads.findByIdAndDelete(image);
                });
            }

        }));
        if (!uploadedImage || uploadedImage === '') return sendErrorResponse(res, {
            type: 'imageId',
            message: 'Image Not found ...'
        });
        faqUpdateData.imageUrl = uploadedImage;
    }
    await Faq.findOneAndUpdate({_id: faqData.id}, {...faqUpdateData}).then(result => {
        result._doc.id = result._id;
        return sendSuccessResponse(res, _.pick(result, ['title', 'content', 'isActive', 'category', 'imageUrl', 'id']));
    }).catch(err => {
        next(err);
    });

});


router.post('/', auth, admin, async (req, res, next) => {
    if (!req.file) {
        console.log(chalk.red('No file received..'));
        throw new Error('No image provided.....');
    }
    console.log(chalk.green('in Upload...'));
    const tempUploadPath = req.file.path;
    const fileExt = req.file.originalname.split('.').pop();
    const uuid = uuidv4();
    const fileName = uuid + '.' + fileExt;
    const storage = new Storage({keyFilename: `${process.env.GOOGLE_APPLICATION_CREDENTIALS}`});
    const bucketName = 'tuitopedia-assets';
    await storage.bucket(bucketName).upload(tempUploadPath, {
        gzip: true,
        public: true,
        destination: `images/${fileName}`,
        metadata: {
            cacheControl: 'public, max-age=31536000',
        },
    }).then(async (saveResult) => {
        console.log(chalk.green(`${tempUploadPath.toString()} uploaded to ${bucketName}. 
        with result https://storage.googleapis.com/${bucketName}/blog_images/${fileName}`));
        const tempUpload = new TempUploads({
            fileName: `images/${fileName}`,
            publicUrl: `https://storage.googleapis.com/${bucketName}/images/${fileName}`,
        })
        await tempUpload.save().then((saveRes) => {
            res.setHeader('Content-Type', 'text/plain')
            return res.send(saveRes._id.toString());
        })
    }).catch((err) => {
        next(err);
    }).finally(() => {
        fs.unlink(tempUploadPath, err => {
            err ? next(err) : '';
        })
    });


});


router.delete('/', auth, admin, async (req, res, next) => {
    const joiValidate = await validateTempUploadDeleteSchema({id: req.body});
    if (joiValidate.error) return sendErrorResponse(res, {
        type: 'VALIDATION',
        message: joiValidate.error.details[0].message
    });
    const storage = new Storage({keyFilename: `${process.env.GOOGLE_APPLICATION_CREDENTIALS}`});
    const bucketName = 'tuitopedia-assets';
    const bucket = storage.bucket(bucketName);
    // await storage.bucket(bucketName).makePublic({});
    const tempUpload = await TempUploads.findById(req.body);
    if (!tempUpload) return sendSuccessResponse(res, {status: 404, data: 'Temp Upload Not Exists ....'});
    await bucket.file(tempUpload.fileName).delete();
    await TempUploads.deleteOne({_id: req.body});
    return res.json({id: req.body});

});

const sendSuccessResponse = (res, responseMessage) => {
    res.json({status: 200, data: responseMessage});
};
const sendErrorResponse = (res, error) => {
    res.status(400).json({status: 400, data: error});
};

module.exports = router;
