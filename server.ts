import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { JWT } from "google-auth-library";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Determine a fully writable folder path.
// On serverless systems like Vercel and AWS Lambda, '/tmp' is the only guaranteed writable directory,
// while inside persistent AI Studio runtime containers we can write to process.cwd() / "data".
const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT || process.env.NODE_ENV === "production");
const DB_DIR = isServerless ? "/tmp" : path.join(process.cwd(), "data");

const PROJECTS_FALLBACK_FILE = path.join(DB_DIR, "projects_fallback.json");
const SUBMISSIONS_FALLBACK_FILE = path.join(DB_DIR, "submissions_fallback.json");
const ALERTS_FALLBACK_FILE = path.join(DB_DIR, "alerts_fallback.json");

// Ensure dynamic database folder exists securely
try {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
} catch (e) {
  console.error("Warning: Failed to create writable DB_DIR, using fallback: " + e);
}

// 1. Beautiful Default Corporate Projects
const defaultProjects: any[] = [];

// 2. Beautiful default initial Daily Status Reports (DSRs)
const defaultSubmissions: any[] = [];

// ==========================================
// GOOGLE SHEETS CORE SYNCHRONIZATION UTILITIES
// ==========================================

const getGoogleAccessToken = async (): Promise<string | null> => {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let rawKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !rawKey) {
    console.log("⚠️ Google Service Account credentials not fully configured in env.");
    return null;
  }

  try {
    const privateKey = rawKey.replace(/\\n/g, '\n');
    const jwt = new JWT({
      email,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const tokenRes = await jwt.getAccessToken();
    return tokenRes.token || null;
  } catch (err) {
    console.error("❌ Failed to authenticate Google Service Account JWT client:", err);
    return null;
  }
};

const ensureSheetExists = async (token: string, spreadsheetId: string, title: string) => {
  try {
    const checkUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
    const res = await fetch(checkUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      console.warn(`Could not verify google spreadsheet ID ${spreadsheetId}. Response status: ${res.status}`);
      return;
    }

    const data: any = await res.json();
    const sheets = data.sheets || [];
    const exists = sheets.some((s: any) => s.properties && s.properties.title === title);

    if (!exists) {
      console.log(`Sheet "${title}" not found. Auto-creating sheet in spreadsheet ${spreadsheetId}...`);
      const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
      const createRes = await fetch(updateUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: { title }
              }
            }
          ]
        })
      });
      if (!createRes.ok) {
        console.error(`Failed to create Sheet "${title}":`, await createRes.text());
      }
    }
  } catch (err) {
    console.error(`Error in ensureSheetExists for "${title}":`, err);
  }
};

const fetchProjectsFromSheets = async (token: string, spreadsheetId: string, sheetName: string = "Projects_Mapping"): Promise<any[][]> => {
  const range = encodeURIComponent(`${sheetName}!A1:Z1000`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Sheets fetch projects API returned ${res.status}: ${text}`);
  }

  const data: any = await res.json();
  return data.values || [];
};

const seedProjectsToSheets = async (token: string, spreadsheetId: string, sheetName: string = "Projects_Mapping") => {
  await ensureSheetExists(token, spreadsheetId, sheetName);
  const headers = [
    "Project Name", "Domain", "Location", "Region", "Users", 
    "Keyword1", "Keyword2", "Keyword3", "Keyword4", "Keyword5", "Keyword6", "Keyword7", "Keyword8"
  ];
  const rows = [
    headers,
    ...defaultProjects.map(p => [
      p.name,
      p.domain,
      p.location,
      p.region,
      p.users.join(', '),
      (p.keywords || [])[0] || "",
      (p.keywords || [])[1] || "",
      (p.keywords || [])[2] || "",
      (p.keywords || [])[3] || "",
      (p.keywords || [])[4] || "",
      (p.keywords || [])[5] || "",
      (p.keywords || [])[6] || "",
      (p.keywords || [])[7] || ""
    ])
  ];

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${sheetName}!A1`)}?valueInputOption=USER_ENTERED`;
  await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ values: rows })
  });
};

const syncProjects = async (token: string, spreadsheetId: string, sheetName: string = "Projects_Mapping") => {
  try {
    await ensureSheetExists(token, spreadsheetId, sheetName);
    let rows = await fetchProjectsFromSheets(token, spreadsheetId, sheetName);
    
    if (rows.length <= 1) {
      console.log(`Projects sheet "${sheetName}" is empty, seeding defaults...`);
      await seedProjectsToSheets(token, spreadsheetId, sheetName);
      rows = await fetchProjectsFromSheets(token, spreadsheetId, sheetName);
    }

    const headers = rows[0] || [];
    const normalizedHeaders = headers.map((h: string) => h.toLowerCase().trim());

    // Auto-detect index of each expected column to fully tolerate column variations
    const colIdx = {
      domain: normalizedHeaders.findIndex(h => h.includes('domain') || h.includes('website') || h.includes('url') || h.includes('link')),
      name: normalizedHeaders.findIndex(h => h.includes('project') || h.includes('name') || h === 'title'),
      location: normalizedHeaders.findIndex(h => h.includes('location') || h.includes('city') || h.includes('office')),
      region: normalizedHeaders.findIndex(h => h.includes('region') || h.includes('zone') || h === 'area'),
      users: normalizedHeaders.findIndex(h => h.includes('users') || h.includes('assign') || h.includes('member') || h.includes('staff') || h.includes('employee'))
    };

    // Find all keyword column indices
    const keywordColIdxs: number[] = [];
    normalizedHeaders.forEach((h, idx) => {
      if (h.includes('keyword')) {
        keywordColIdxs.push(idx);
      }
    });

    const localProjMap = new Map<string, any>();
    if (fs.existsSync(PROJECTS_FALLBACK_FILE)) {
      try {
        const localList = JSON.parse(fs.readFileSync(PROJECTS_FALLBACK_FILE, "utf-8"));
        localList.forEach((p: any) => {
          if (p.id) localProjMap.set(p.id, p);
        });
      } catch (err) {
        console.error("Failed to parse projects local fallback:", err);
      }
    }

    const mapped = rows.slice(1).map((row: any) => {
      const getVal = (idx: number, fallback: string = "") => {
        return (idx !== -1 && row[idx] !== undefined && row[idx] !== null) ? row[idx].toString().trim() : fallback;
      };

      const domain = getVal(colIdx.domain);
      const name = getVal(colIdx.name, domain || "Unnamed Project");
      
      const cleanDomain = domain.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
      const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
      const id = cleanDomain || cleanName || `p-${Date.now()}`;
      const code = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || "PROJ";

      const location = getVal(colIdx.location, "Mumbai");
      const region = getVal(colIdx.region, "West");
      const usersStr = getVal(colIdx.users);
      const description = "";

      const localP = localProjMap.get(id);
      const priority = localP ? (localP.priority || "") : "";
      const frequency = localP ? (localP.frequency || "") : "";

      const usersList = usersStr 
        ? usersStr.split(/[,;|]/).map((u: string) => u.trim().toLowerCase()).filter(Boolean) 
        : [];

      // Fetch keywords up to 8
      const keywords: string[] = [];
      keywordColIdxs.forEach(idx => {
        const val = getVal(idx);
        if (val && keywords.length < 8) {
          keywords.push(val);
        }
      });

      return {
        id,
        domain,
        name,
        code,
        location,
        region,
        users: usersList,
        description,
        priority,
        frequency,
        keywords
      };
    }).filter((p: any) => p.name);

    fs.writeFileSync(PROJECTS_FALLBACK_FILE, JSON.stringify(mapped, null, 2));
    return mapped;
  } catch (err) {
    console.error("❌ Error syncing projects from Google Sheets, using local cache:", err);
    if (fs.existsSync(PROJECTS_FALLBACK_FILE)) {
      return JSON.parse(fs.readFileSync(PROJECTS_FALLBACK_FILE, "utf-8"));
    }
    return defaultProjects;
  }
};

const fetchSubmissionsFromSheets = async (token: string, spreadsheetId: string, sheetName: string = "DSR_Logs"): Promise<any[][]> => {
  await ensureSheetExists(token, spreadsheetId, sheetName);
  const range = encodeURIComponent(`${sheetName}!A1:Z5000`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Sheets fetch submissions API returned ${res.status}: ${text}`);
  }

  const data: any = await res.json();
  return data.values || [];
};

const parseSubmissionsRows = (rows: string[][]): any[] => {
  if (rows.length <= 1) {
    return [];
  }

  const groupedEntries: Record<string, any> = {};

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0] || !row[1] || !row[2]) continue;

    const subBlockId = row[0];
    const dsrParentId = subBlockId.split('-').slice(0, 2).join('-');
    const date = row[1];
    const userEmail = row[2];
    const projectId = row[3] || '';
    const projectName = row[4] || '';
    const listingCount = parseInt(row[5], 10) || 0;
    const blogCount = parseInt(row[6], 10) || 0;
    const pdfCount = parseInt(row[7], 10) || 0;
    const imageCount = parseInt(row[8], 10) || 0;
    const blogNarrative = row[9] || '';
    
    let customValues = {};
    try {
      if (row[10] && row[10].trim().startsWith('{')) {
        customValues = JSON.parse(row[10]);
      }
    } catch (e) {
      console.warn('Corrupted custom JSON:', row[10]);
    }

    const createdAt = row[11] || new Date().toISOString();
    const workTypes = row[12] ? row[12].split(',').map((s: string) => s.trim()).filter(Boolean) : [];
    const contentUpdates = row[13] ? row[13].split(',').map((s: string) => s.trim()).filter(Boolean) : [];
    const workSummary = row[14] || '';
    const forumCount = parseInt(row[15], 10) || 0;
    const videoPptCount = parseInt(row[16], 10) || 0;
    const profileCount = parseInt(row[17], 10) || 0;
    const linkCount = parseInt(row[18], 10) || 0;
    const priorityVal = row[19] || '';
    const frequencyVal = row[20] || '';

    const workItem = {
      id: subBlockId,
      projectId,
      projectName,
      listingCount,
      blogCount,
      forumCount,
      pdfCount,
      imageCount,
      videoPptCount,
      profileCount,
      linkCount,
      blog: blogNarrative,
      customValues,
      workTypes,
      contentUpdates,
      selectedKeywords: (customValues as any)?.selectedKeywords || [],
      workSummary,
      priority: priorityVal,
      frequency: frequencyVal
    };

    if (!groupedEntries[dsrParentId]) {
      groupedEntries[dsrParentId] = {
        id: dsrParentId,
        date,
        userEmail,
        works: [],
        createdAt
      };
    }
    groupedEntries[dsrParentId].works.push(workItem);
  }

  return Object.values(groupedEntries).sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt));
};

const syncSubmissions = async (token: string, spreadsheetId: string, sheetName: string = "DSR_Logs") => {
  try {
    const rows = await fetchSubmissionsFromSheets(token, spreadsheetId, sheetName);
    
    if (rows.length === 0) {
      console.log(`Headers empty in "${sheetName}", initializing DSR headers...`);
      const headers = [
        'DSR ID', 'Reporting Date', 'User Email', 'Project ID', 'Project Name',
        'Listing Count', 'Blog Count', 'PDF Count', 'Image Count', 'Work Narrative',
        'Custom Values JSON', 'CreatedAt', 'Work Types', 'Content Updates', 'Work Summary',
        'Forum Count', 'Video PPT Count', 'Profile Count', 'Link Count', 'Priority', 'Frequency'
      ];
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${sheetName}!A1`)}?valueInputOption=USER_ENTERED`;
      await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ values: [headers] })
      });
      return [];
    }

    const parsed = parseSubmissionsRows(rows);
    fs.writeFileSync(SUBMISSIONS_FALLBACK_FILE, JSON.stringify(parsed, null, 2));
    return parsed;
  } catch (err) {
    console.error("❌ Error syncing DSR submissions from Google Sheets, using local cache:", err);
    if (fs.existsSync(SUBMISSIONS_FALLBACK_FILE)) {
      return JSON.parse(fs.readFileSync(SUBMISSIONS_FALLBACK_FILE, "utf-8"));
    }
    return defaultSubmissions;
  }
};

const writeAllProjectsToSheets = async (token: string, spreadsheetId: string, projectsList: any[], sheetName: string = "Projects_Mapping") => {
  try {
    await ensureSheetExists(token, spreadsheetId, sheetName);
    const headers = [
      "Project Name", "Domain", "Location", "Region", "Users", 
      "Keyword1", "Keyword2", "Keyword3", "Keyword4", "Keyword5", "Keyword6", "Keyword7", "Keyword8"
    ];
    const rows = [
      headers,
      ...projectsList.map(p => {
        const row = [
          p.name,
          p.domain,
          p.location,
          p.region,
          (p.users || []).join(', ')
        ];
        // Pad keywords
        const kws = p.keywords || [];
        for (let i = 0; i < 8; i++) {
          row.push(kws[i] || "");
        }
        return row;
      })
    ];

    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${sheetName}!A1:M1000`)}:clear`;
    await fetch(clearUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${sheetName}!A1`)}?valueInputOption=USER_ENTERED`;
    await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ values: rows })
    });
    console.log(`Successfully synchronised all projects to Google Sheets tab "${sheetName}".`);
  } catch (err) {
    console.error("Failed writing projects to sheets:", err);
  }
};

// Initialize dynamic local files on boot if empty
try {
  let projectsList: any[] = [];
  if (fs.existsSync(PROJECTS_FALLBACK_FILE)) {
    try {
      const existing = JSON.parse(fs.readFileSync(PROJECTS_FALLBACK_FILE, "utf-8"));
      if (Array.isArray(existing)) {
        projectsList = existing.filter((p: any) => p && p.id !== "titan-realestate" && p.id !== "aerospace-craft" && p.id !== "clean-energy");
      }
    } catch (e) {}
  }
  fs.writeFileSync(PROJECTS_FALLBACK_FILE, JSON.stringify(projectsList, null, 2));
} catch (e) {
  console.error("Warning: Could not seed PROJECTS_FALLBACK_FILE:", e);
}

try {
  let subsList: any[] = [];
  if (fs.existsSync(SUBMISSIONS_FALLBACK_FILE)) {
    try {
      const existing = JSON.parse(fs.readFileSync(SUBMISSIONS_FALLBACK_FILE, "utf-8"));
      if (Array.isArray(existing)) {
        subsList = existing.filter((s: any) => s && s.projectId !== "titan-realestate" && s.projectId !== "aerospace-craft" && s.projectId !== "clean-energy");
      }
    } catch (e) {}
  }
  fs.writeFileSync(SUBMISSIONS_FALLBACK_FILE, JSON.stringify(subsList, null, 2));
} catch (e) {
  console.error("Warning: Could not seed SUBMISSIONS_FALLBACK_FILE:", e);
}

try {
  if (!fs.existsSync(ALERTS_FALLBACK_FILE)) {
    fs.writeFileSync(ALERTS_FALLBACK_FILE, JSON.stringify([], null, 2));
  }
} catch (e) {
  console.error("Warning: Could not seed ALERTS_FALLBACK_FILE:", e);
}

// 3. User Authorization Registry (Backend Lists)
const ALLOWED_ADMINS = [
  "vatsalpatelwork20@gmail.com"
];

const ALLOWED_USERS = [
  "vatsal.assetscout@gmail.com",
];

// ==========================================
// API ENDPOINTS
// ==========================================

// GET Auth configurations for sync
app.get("/api/auth/config", (req, res) => {
  res.json({
    allowedAdmins: ALLOWED_ADMINS,
    allowedUsers: ALLOWED_USERS
  });
});

// POST verify user login email
app.post("/api/auth/verify", (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ allowed: false, error: "Email is required." });
  }

  const emailLower = email.trim().toLowerCase();
  const isAdmin = ALLOWED_ADMINS.some(adm => adm.toLowerCase() === emailLower);

  // Auto-register any new emails entered so they can see logs instantly
  if (!ALLOWED_USERS.some(u => u.toLowerCase() === emailLower)) {
    ALLOWED_USERS.push(emailLower);
  }

  return res.json({
    allowed: true,
    role: isAdmin ? "admin" : "user",
    allowedAdmins: ALLOWED_ADMINS,
    allowedUsers: ALLOWED_USERS
  });
});

const getSpreadsheetId = (req: any, type: 'projects' | 'logs'): string | null => {
  // Always prioritize environment variables if configured
  const envId = type === 'projects' ? process.env.GOOGLE_PROJECTS_SPREADSHEET_ID : process.env.GOOGLE_LOGS_SPREADSHEET_ID;
  if (envId && envId.trim()) {
    return envId.trim();
  }

  const specificHeaderKey = type === 'projects' ? 'x-projects-spreadsheet-id' : 'x-logs-spreadsheet-id';
  const specificHeaderId = req.headers[specificHeaderKey];
  if (specificHeaderId && typeof specificHeaderId === 'string' && specificHeaderId.trim()) {
    return specificHeaderId.trim();
  }

  const headerId = req.headers['x-spreadsheet-id'];
  if (headerId && typeof headerId === 'string' && headerId.trim()) {
    return headerId.trim();
  }

  return null;
};

// Config diagnostics status route
app.get("/api/config-status", async (req, res) => {
  const token = await getGoogleAccessToken();
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "";
  const projectsId = getSpreadsheetId(req, 'projects') || "Local fallback active";
  const logsId = getSpreadsheetId(req, 'logs') || "Local fallback active";

  return res.json({
    serviceAccountConfigured: !!token,
    serviceAccountEmail: serviceAccountEmail || "None",
    projectsSpreadsheetId: projectsId,
    logsSpreadsheetId: logsId,
    fetchStatus: { ok: !!token, error: token ? "" : "No token authorized" },
    databaseStatus: { ok: true, error: "" }
  });
});

// GET All Projects
app.get("/api/projects", async (req, res) => {
  try {
    const token = await getGoogleAccessToken();
    const spreadsheetId = getSpreadsheetId(req, 'projects');
    const projectsTab = (req.headers['x-projects-tab'] as string) || "Projects_Mapping";

    if (token && spreadsheetId) {
      const list = await syncProjects(token, spreadsheetId, projectsTab);
      return res.json(list);
    }

    const list = JSON.parse(fs.readFileSync(PROJECTS_FALLBACK_FILE, "utf-8"));
    return res.json(list);
  } catch (err: any) {
    console.error("GET /api/projects error:", err);
    try {
      const list = JSON.parse(fs.readFileSync(PROJECTS_FALLBACK_FILE, "utf-8"));
      return res.json(list);
    } catch {
      return res.json(defaultProjects);
    }
  }
});

// ADD, EDIT, DELETE Projects
app.post("/api/projects", async (req, res) => {
  const { action, project } = req.body;
  try {
    let list = [];
    try {
      list = JSON.parse(fs.readFileSync(PROJECTS_FALLBACK_FILE, "utf-8"));
    } catch {
      list = [...defaultProjects];
    }

    if (action === "add" && project) {
      project.id = project.domain.toLowerCase().replace(/[^a-z0-9]/g, "-") || `p-${Date.now()}`;
      list.push(project);
    } else if (action === "edit" && project) {
      const idx = list.findIndex((p: any) => p.id === project.id);
      if (idx !== -1) {
        list[idx] = project;
      }
    } else if (action === "delete" && project) {
      list = list.filter((p: any) => p.id !== project.id);
    }

    fs.writeFileSync(PROJECTS_FALLBACK_FILE, JSON.stringify(list, null, 2));

    const token = await getGoogleAccessToken();
    const spreadsheetId = getSpreadsheetId(req, 'projects');
    const projectsTab = (req.headers['x-projects-tab'] as string) || "Projects_Mapping";
    if (token && spreadsheetId) {
      await writeAllProjectsToSheets(token, spreadsheetId, list, projectsTab);
    }

    return res.json({ success: true, list });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET filters combinations
app.get("/api/filters", async (req, res) => {
  try {
    let projectsArr = [];
    const token = await getGoogleAccessToken();
    const spreadsheetId = getSpreadsheetId(req, 'projects');
    const projectsTab = (req.headers['x-projects-tab'] as string) || "Projects_Mapping";
    const submissionsTab = (req.headers['x-submissions-tab'] as string) || "DSR_Logs";

    if (token && spreadsheetId) {
      projectsArr = await syncProjects(token, spreadsheetId, projectsTab);
    } else {
      try {
        projectsArr = JSON.parse(fs.readFileSync(PROJECTS_FALLBACK_FILE, "utf-8"));
      } catch {
        projectsArr = [...defaultProjects];
      }
    }

    const uniqueLocations = new Set<string>();
    const uniqueRegions = new Set<string>();
    const uniqueEmails = new Set<string>();

    projectsArr.forEach((p: any) => {
      if (p.location) uniqueLocations.add(p.location);
      if (p.region) uniqueRegions.add(p.region);
      if (p.users && Array.isArray(p.users)) {
        p.users.forEach((u: string) => uniqueEmails.add(u.toLowerCase()));
      }
    });

    let submissionsArr = [];
    const logsToken = await getGoogleAccessToken();
    const logsSpreadsheetId = getSpreadsheetId(req, 'logs');

    if (logsToken && logsSpreadsheetId) {
      submissionsArr = await syncSubmissions(logsToken, logsSpreadsheetId, submissionsTab);
    } else {
      try {
        submissionsArr = JSON.parse(fs.readFileSync(SUBMISSIONS_FALLBACK_FILE, "utf-8"));
      } catch {
        submissionsArr = [...defaultSubmissions];
      }
    }

    submissionsArr.forEach((entry: any) => {
      if (entry.userEmail) {
        uniqueEmails.add(entry.userEmail.trim().toLowerCase());
      }
    });

    if (uniqueLocations.size === 0) {
      uniqueLocations.add("Mumbai");
      uniqueLocations.add("Delhi");
      uniqueLocations.add("Bengaluru");
    }
    if (uniqueRegions.size === 0) {
      uniqueRegions.add("North");
      uniqueRegions.add("West");
      uniqueRegions.add("South");
    }

    return res.json({
      projects: projectsArr,
      locations: Array.from(uniqueLocations).sort(),
      regions: Array.from(uniqueRegions).sort(),
      users: Array.from(uniqueEmails).map(email => ({
        email,
        name: email.includes('@') ? email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1) : email
      })).sort((a, b) => a.name.localeCompare(b.name))
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET Submissions Logs
app.get("/api/submissions", async (req, res) => {
  try {
    const token = await getGoogleAccessToken();
    const spreadsheetId = getSpreadsheetId(req, 'logs');
    const submissionsTab = (req.headers['x-submissions-tab'] as string) || "DSR_Logs";

    if (token && spreadsheetId) {
      const list = await syncSubmissions(token, spreadsheetId, submissionsTab);
      return res.json(list);
    }

    const list = JSON.parse(fs.readFileSync(SUBMISSIONS_FALLBACK_FILE, "utf-8"));
    return res.json(list);
  } catch (err) {
    console.error("GET /api/submissions error:", err);
    try {
      const list = JSON.parse(fs.readFileSync(SUBMISSIONS_FALLBACK_FILE, "utf-8"));
      return res.json(list);
    } catch {
      return res.json(defaultSubmissions);
    }
  }
});

// POST Log DSR Submission (Append to local file database and Google Sheets)
app.post("/api/submissions/append", async (req, res) => {
  const { works, date, userEmail } = req.body;
  if (!userEmail || !works || !Array.isArray(works)) {
    return res.status(400).json({ error: "Missing required submission parameters." });
  }

  const submissionId = `dsr-${Date.now()}`;
  const createdAt = new Date().toISOString();

  try {
    let list = [];
    try {
      list = JSON.parse(fs.readFileSync(SUBMISSIONS_FALLBACK_FILE, "utf-8"));
    } catch {
      list = [...defaultSubmissions];
    }

    const worksWithIds = works.map((w: any, index: number) => ({
      ...w,
      id: `${submissionId}-${index}`
    }));

    list.unshift({
      id: submissionId,
      date,
      userEmail,
      works: worksWithIds,
      createdAt
    });

    fs.writeFileSync(SUBMISSIONS_FALLBACK_FILE, JSON.stringify(list, null, 2));

    const token = await getGoogleAccessToken();
    const spreadsheetId = getSpreadsheetId(req, 'logs');
    const submissionsTab = (req.headers['x-submissions-tab'] as string) || "DSR_Logs";

    if (token && spreadsheetId) {
      const sheetName = submissionsTab;
      await ensureSheetExists(token, spreadsheetId, sheetName);

      let projectsList: any[] = [];
      try {
        if (fs.existsSync(PROJECTS_FALLBACK_FILE)) {
          projectsList = JSON.parse(fs.readFileSync(PROJECTS_FALLBACK_FILE, "utf-8"));
        } else {
          projectsList = [...defaultProjects];
        }
      } catch (err) {
        projectsList = [];
      }

      const rowsToWrite = works.map((work: any, index: number) => {
        const proj = projectsList.find((p: any) => p.id === work.projectId || p.name === work.projectName);
        const priority = proj ? (proj.priority || '') : '';
        const frequency = proj ? (proj.frequency || '') : '';

        return [
          `${submissionId}-${index}`,
          date,
          userEmail,
          work.projectId,
          work.projectName,
          (work.listingCount || 0).toString(),
          (work.blogCount || 0).toString(),
          (work.pdfCount || 0).toString(),
          (work.imageCount || 0).toString(),
          work.blog || '',
          JSON.stringify(work.customValues || {}),
          createdAt,
          (work.workTypes || []).join(', '),
          (work.contentUpdates || []).join(', '),
          work.workSummary || '',
          (work.forumCount ?? 0).toString(),
          (work.videoPptCount ?? 0).toString(),
          (work.profileCount ?? 0).toString(),
          (work.linkCount ?? 0).toString(),
          priority,
          frequency
        ];
      });

      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${sheetName}!A1`)}:append?valueInputOption=USER_ENTERED`;
      const sheetsAppendRes = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ values: rowsToWrite })
      });

      if (!sheetsAppendRes.ok) {
        console.error("Failed appending to Google Sheets: status", sheetsAppendRes.status, await sheetsAppendRes.text());
      } else {
        console.log("Appended work rows to Google Sheets successfully.");
      }
    }

    return res.json({ success: true, source: token && spreadsheetId ? "Google Sheets + Local Backup" : "Local File DB Only" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Clear logs/submissions restriction
app.delete("/api/submissions", (req, res) => {
  return res.status(403).json({ error: "Logs cannot be deleted from history." });
});

// GET Alerts
app.get("/api/alerts", (req, res) => {
  try {
    const list = JSON.parse(fs.readFileSync(ALERTS_FALLBACK_FILE, "utf-8"));
    res.json(list);
  } catch {
    res.json([]);
  }
});

// POST alert notifications to admin
app.post("/api/alerts", (req, res) => {
  const { alert } = req.body;
  if (!alert) {
    return res.status(400).json({ error: "Missing alert data" });
  }

  try {
    const list = JSON.parse(fs.readFileSync(ALERTS_FALLBACK_FILE, "utf-8"));
    list.unshift(alert);
    fs.writeFileSync(ALERTS_FALLBACK_FILE, JSON.stringify(list, null, 2));
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST Clear/Dismiss alerts
app.post("/api/alerts/clear", (req, res) => {
  const { id, all } = req.body;
  try {
    let list = JSON.parse(fs.readFileSync(ALERTS_FALLBACK_FILE, "utf-8"));
    if (all) {
      list = list.map((a: any) => ({ ...a, read: true }));
    } else if (id) {
      list = list.filter((a: any) => a.id !== id);
    }
    fs.writeFileSync(ALERTS_FALLBACK_FILE, JSON.stringify(list, null, 2));
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// STATIC FRONTEND SERVING & VITE
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express Local DB Server running on port ${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
