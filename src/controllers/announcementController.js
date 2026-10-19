const Announcement = require('../models/Announcement');
const AdminLog = require('../models/AdminLog');

/**
 * @desc    Get all active announcements (public)
 * @route   GET /api/announcement
 * @access  Public
 */
const getActiveAnnouncements = async (req, res, next) => {
    try {
        const now = new Date();

        const announcements = await Announcement.find({
            isActive: true,
            $or: [
                { expiresAt: { $exists: false } },
                { expiresAt: { $gt: now } },
                { expiresAt: null }
            ]
        }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: announcements.length,
            data: announcements
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get all announcements (admin)
 * @route   GET /api/announcement/admin
 * @access  Admin
 */
const getAllAnnouncements = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const announcements = await Announcement.find()
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Announcement.countDocuments();

        res.status(200).json({
            success: true,
            count: announcements.length,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            },
            data: announcements
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Create new announcement
 * @route   POST /api/announcement
 * @access  Admin
 */
const createAnnouncement = async (req, res, next) => {
    try {
        req.body.createdBy = req.user._id;

        const announcement = await Announcement.create(req.body);

        // Log admin action
        await AdminLog.logAction(
            req.user._id,
            'announcement_created',
            'announcement',
            announcement._id,
            { title: announcement.title },
            req
        );

        res.status(201).json({
            success: true,
            data: announcement
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Update announcement
 * @route   PUT /api/announcement/:id
 * @access  Admin
 */
const updateAnnouncement = async (req, res, next) => {
    try {
        let announcement = await Announcement.findById(req.params.id);

        if (!announcement) {
            return res.status(404).json({
                success: false,
                error: 'Announcement not found'
            });
        }

        announcement = await Announcement.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        // Log admin action
        await AdminLog.logAction(
            req.user._id,
            'announcement_updated',
            'announcement',
            announcement._id,
            { updatedFields: Object.keys(req.body) },
            req
        );

        res.status(200).json({
            success: true,
            data: announcement
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Delete announcement
 * @route   DELETE /api/announcement/:id
 * @access  Admin
 */
const deleteAnnouncement = async (req, res, next) => {
    try {
        const announcement = await Announcement.findById(req.params.id);

        if (!announcement) {
            return res.status(404).json({
                success: false,
                error: 'Announcement not found'
            });
        }

        await announcement.deleteOne();

        // Log admin action
        await AdminLog.logAction(
            req.user._id,
            'announcement_deleted',
            'announcement',
            req.params.id,
            { title: announcement.title },
            req
        );

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getActiveAnnouncements,
    getAllAnnouncements,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement
};
