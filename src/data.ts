import { Project, DSREntry } from './types';

export const ADMIN_EMAILS = [
  'vatsalpatel1720@gmail.com',
  'vatsalpatelwork20@gmail.com'
];

export const DEFAULT_ALLOWED_USERS = [
  'vatsal.assetscout@gmail.com',
  'vatsalpatel1720@gmail.com',
  'vatsalpatelwork20@gmail.com'
];

export const DEFAULT_PROJECTS: Project[] = [
  {
    id: "titan-realestate",
    domain: "titan-realestate.com",
    name: "Titan Real Estate Corporate",
    code: "TITN",
    location: "Mumbai",
    region: "West",
    users: ["vatsal.assetscout@gmail.com", "vatsalpatel1720@gmail.com", "vatsalpatelwork20@gmail.com"],
    description: "Titan core asset monitoring portal"
  },
  {
    id: "aerospace-craft",
    domain: "aerospace-craft.org",
    name: "AeroSpace Craft Logistics",
    code: "AERO",
    location: "Delhi",
    region: "North",
    users: ["vatsal.assetscout@gmail.com", "vatsalpatel1720@gmail.com", "vatsalpatelwork20@gmail.com"],
    description: "Green technology operations"
  },
  {
    id: "clean-energy",
    domain: "clean-energy.net",
    name: "Clean Energy Development",
    code: "CLNR",
    location: "Bengaluru",
    region: "South",
    users: ["vatsal.assetscout@gmail.com", "vatsalpatel1720@gmail.com", "vatsalpatelwork20@gmail.com"],
    description: "Solar deployment management"
  }
];

// Seed empty array to remove dummy DSR logs
export const INITIAL_DSR_ENTRIES: DSREntry[] = [];
