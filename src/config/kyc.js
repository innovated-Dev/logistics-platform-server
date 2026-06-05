/**
 * KYC_CONFIG — Nigeria first, built to expand.
 *
 * To add a new country: add a new key at the top level (e.g. 'GH' for Ghana).
 * To add a new vehicle type: add a new key inside a country object.
 * The frontend and backend both read from this config — nothing is hardcoded.
 */

const KYC_CONFIG = {
  NG: {
    motorcycle: [
      {
        key: 'nin_document',
        label: 'NIN Slip / ID Card',
        hint: 'Your National Identification Number document or slip',
        icon: 'id',
        accept: 'image/jpeg,image/png,application/pdf',
        maxSizeMB: 5,
        required: true,
      },
      {
        key: 'passport_photo',
        label: 'Passport Photograph',
        hint: 'Clear passport-sized photo of your face, white background preferred',
        icon: 'user',
        accept: 'image/jpeg,image/png',
        maxSizeMB: 3,
        required: true,
      },
      {
        key: 'drivers_licence',
        label: "Driver's Licence (FRSC)",
        hint: 'Front page of a valid FRSC-issued driver\'s licence',
        icon: 'license',
        accept: 'image/jpeg,image/png,application/pdf',
        maxSizeMB: 5,
        required: true,
      },
      {
        key: 'riders_permit',
        label: 'State Rider\'s Permit',
        hint: 'Required in Lagos and Abuja. Upload if your state issues this.',
        icon: 'certificate',
        accept: 'image/jpeg,image/png,application/pdf',
        maxSizeMB: 5,
        required: false, // optional — not all states issue this
      },
      {
        key: 'vehicle_licence',
        label: 'Vehicle Licence',
        hint: 'Current vehicle licence / particulars for your motorcycle',
        icon: 'file-description',
        accept: 'image/jpeg,image/png,application/pdf',
        maxSizeMB: 5,
        required: true,
      },
      {
        key: 'vehicle_insurance',
        label: 'Insurance Certificate',
        hint: 'Upload if you have one. Not required but strongly recommended.',
        icon: 'shield-check',
        accept: 'image/jpeg,image/png,application/pdf',
        maxSizeMB: 5,
        required: false, // optional — many riders in NG don't have this
      },
      {
        key: 'plate_photo',
        label: 'Plate Number Photo',
        hint: 'Clear photo of your motorcycle plate number',
        icon: 'camera',
        accept: 'image/jpeg,image/png',
        maxSizeMB: 3,
        required: true,
      },
    ],

    bicycle: [
      {
        key: 'nin_document',
        label: 'NIN Slip / ID Card',
        hint: 'Your National Identification Number document or slip',
        icon: 'id',
        accept: 'image/jpeg,image/png,application/pdf',
        maxSizeMB: 5,
        required: true,
      },
      {
        key: 'passport_photo',
        label: 'Passport Photograph',
        hint: 'Clear passport-sized photo of your face, white background preferred',
        icon: 'user',
        accept: 'image/jpeg,image/png',
        maxSizeMB: 3,
        required: true,
      },
    ],

    car: [
      {
        key: 'nin_document',
        label: 'NIN Slip / ID Card',
        hint: 'Your National Identification Number document or slip',
        icon: 'id',
        accept: 'image/jpeg,image/png,application/pdf',
        maxSizeMB: 5,
        required: true,
      },
      {
        key: 'passport_photo',
        label: 'Passport Photograph',
        hint: 'Clear passport-sized photo of your face, white background preferred',
        icon: 'user',
        accept: 'image/jpeg,image/png',
        maxSizeMB: 3,
        required: true,
      },
      {
        key: 'drivers_licence',
        label: "Driver's Licence (FRSC)",
        hint: 'Front page of a valid FRSC-issued driver\'s licence',
        icon: 'license',
        accept: 'image/jpeg,image/png,application/pdf',
        maxSizeMB: 5,
        required: true,
      },
      {
        key: 'vehicle_licence',
        label: 'Vehicle Licence',
        hint: 'Current vehicle licence / particulars for your car',
        icon: 'file-description',
        accept: 'image/jpeg,image/png,application/pdf',
        maxSizeMB: 5,
        required: true,
      },
      {
        key: 'vehicle_insurance',
        label: 'Insurance Certificate',
        hint: 'Current vehicle insurance certificate',
        icon: 'shield-check',
        accept: 'image/jpeg,image/png,application/pdf',
        maxSizeMB: 5,
        required: true,
      },
      {
        key: 'roadworthiness',
        label: 'Roadworthiness Certificate',
        hint: 'Valid roadworthiness certificate issued by FRSC or state authority',
        icon: 'clipboard-check',
        accept: 'image/jpeg,image/png,application/pdf',
        maxSizeMB: 5,
        required: true,
      },
      {
        key: 'plate_photo',
        label: 'Plate Number Photo',
        hint: 'Clear photo of your vehicle plate number',
        icon: 'camera',
        accept: 'image/jpeg,image/png',
        maxSizeMB: 3,
        required: true,
      },
    ],

    van: [
      {
        key: 'nin_document',
        label: 'NIN Slip / ID Card',
        hint: 'Your National Identification Number document or slip',
        icon: 'id',
        accept: 'image/jpeg,image/png,application/pdf',
        maxSizeMB: 5,
        required: true,
      },
      {
        key: 'passport_photo',
        label: 'Passport Photograph',
        hint: 'Clear passport-sized photo of your face, white background preferred',
        icon: 'user',
        accept: 'image/jpeg,image/png',
        maxSizeMB: 3,
        required: true,
      },
      {
        key: 'drivers_licence',
        label: "Driver's Licence (FRSC) — Commercial",
        hint: 'Must be a commercial/heavy vehicle licence for vans and mini-trucks',
        icon: 'license',
        accept: 'image/jpeg,image/png,application/pdf',
        maxSizeMB: 5,
        required: true,
      },
      {
        key: 'vehicle_licence',
        label: 'Vehicle Licence',
        hint: 'Current vehicle licence / particulars for your van or mini-truck',
        icon: 'file-description',
        accept: 'image/jpeg,image/png,application/pdf',
        maxSizeMB: 5,
        required: true,
      },
      {
        key: 'vehicle_insurance',
        label: 'Insurance Certificate',
        hint: 'Current vehicle insurance — third party minimum',
        icon: 'shield-check',
        accept: 'image/jpeg,image/png,application/pdf',
        maxSizeMB: 5,
        required: true,
      },
      {
        key: 'roadworthiness',
        label: 'Roadworthiness Certificate',
        hint: 'Valid roadworthiness certificate issued by FRSC or state authority',
        icon: 'clipboard-check',
        accept: 'image/jpeg,image/png,application/pdf',
        maxSizeMB: 5,
        required: true,
      },
      {
        key: 'plate_photo',
        label: 'Plate Number Photo',
        hint: 'Clear photo of your van or mini-truck plate number',
        icon: 'camera',
        accept: 'image/jpeg,image/png',
        maxSizeMB: 3,
        required: true,
      },
    ],
  },

  // GH: { ... } ← Ghana config goes here when you expand
};

export default KYC_CONFIG;