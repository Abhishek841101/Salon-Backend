import mongoose from "mongoose";

const salonSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Salon name is required"],
      trim: true,
      maxlength: 150,
    },

    ownerName: {
      type: String,
      required: [true, "Owner name is required"],
      trim: true,
      maxlength: 100,
    },

    email: {
      type: String,
      required: [true, "Salon email is required"],
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      required: [true, "Salon phone is required"],
      trim: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Salon = mongoose.model("Salon", salonSchema);

export default Salon;