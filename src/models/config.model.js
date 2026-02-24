import { add } from "date-fns";
import mongoose from "mongoose";

const configSchema = new mongoose.Schema({
  office_info: {
    name: { type: String, trim: true },
    business_field: { type: String, trim: true },
    company_logo: { type: String, trim: true },
    address: { type: String, trim: true },
    email: { type: String, trim: true },
    contact: { type: String, trim: true },
    logo: { type: String, trim: true },
    linkedin: { type: String, trim: true },
    instagram: { type: String, trim: true },
    facebook: { type: String, trim: true },
    youtube: { type: String, trim: true },
    tiktok: { type: String, trim: true },
    website: { type: String, trim: true },
  },
  allowed_ips: {
    type: Map,
    of: String,
  },
  office_location: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
  },

  working_hours: {
    checkin_time: { type: Date, required: true },
    checkout_time: { type: Date, required: true },
  },
  bd_working_hours: {
    checkin_time: { type: Date, required: true },
    checkout_time: { type: Date, required: true },
  },
  general_leave_types: {
    annual: { type: Number, default: 10 },
    casual: { type: Number, default: 7 },
    demise: { type: Number, default: 5 },
    "hajj/umrah": { type: Number, default: 5 },
    marriage: { type: Number, default: 5 },
    maternity: { type: Number, default: 90 },
    paternity: { type: Number, default: 5 },
    probation: { type: Number, default: 3 },
    sick: { type: Number, default: 7 },
    unpaid: { type: Number, default: 10 },
  },
  business_leave_types: {
    annual: { type: Number, default: 10 },
    casual: { type: Number, default: 7 },
    demise: { type: Number, default: 5 },
    "hajj/umrah": { type: Number, default: 5 },
    marriage: { type: Number, default: 5 },
    maternity: { type: Number, default: 90 },
    paternity: { type: Number, default: 5 },
    probation: { type: Number, default: 3 },
    sick: { type: Number, default: 7 },
    unpaid: { type: Number, default: 10 },
  },

  allowedLeaveForPermanentEmployees: {
    type: Number,
    required: true,
    default: 24,
  },
  allowedLeaveForPermanentBusinessDevelopers: {
    type: Number,
    required: true,
    default: 24,
  },
  allowedLeaveForProbationInternshipEmployees: {
    type: Number,
    required: true,
    default: 3,
  },
  isSignup: {
    type: Boolean,
    default: false,
  },
  buffer_time_minutes: { type: Number, default: 30 },
  enable_ip_check: {
    type: Boolean,
    default: true,
  },
});

export default mongoose.model("OfficeConfigs", configSchema);
