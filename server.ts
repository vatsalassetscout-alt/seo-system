import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { JWT } from "google-auth-library";
import dotenv from "dotenv";

dotenv.config();

// =========================================================================
// DIRECT GOOGLE SHEETS PIPELINE CONFIGURATION (NOT IN ENV, ENTER HERE DIRECTLY)
// =========================================================================
// ⚠️ You can directly write your Google Sheets configurations inside the code!
// Leaving these empty ("") will automatically fall back to environment variables and headers.
const DIRECT_GOOGLE_API_KEY: string = ""; // 👈 Put your Google Sheets API Key here (e.g. "AIzaSy...")
const DIRECT_SPREADSHEET_ID: string = ""; // 👈 Put your primary Google Sheet ID/Spreadsheet ID here
const DIRECT_PROJECTS_SHEET_NAME: string = "Projects_Mapping"; // 👈 Tab name containing projects list
const DIRECT_DSR_LOGS_SHEET_NAME: string = "DSR_Logs"; // 👈 Tab name containing log sheets rows

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
const ACTIVITIES_FALLBACK_FILE = path.join(DB_DIR, "activities_fallback.json");

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

const getGoogleAuth = async (req: any): Promise<{ token: string; isApiKey: boolean } | null> => {
  // 0. Check directly hardcoded API Key first
  if (DIRECT_GOOGLE_API_KEY && DIRECT_GOOGLE_API_KEY.trim()) {
    return { token: DIRECT_GOOGLE_API_KEY.trim(), isApiKey: true };
  }

  // 1. Check if client passed a custom API Key via the header
  const clientApiKey = req.headers['x-google-api-key'];
  if (clientApiKey && typeof clientApiKey === 'string' && clientApiKey.trim()) {
    return { token: clientApiKey.trim(), isApiKey: true };
  }

  // 2. Check if a client OAuth Authorization header is passed
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.substring(7).trim();
    if (bearerToken && bearerToken !== "undefined" && bearerToken !== "null" && bearerToken.length > 5) {
      return { token: bearerToken, isApiKey: false };
    }
  }

  // 3. Fallback to Server environment variables: GOOGLE_API_KEY
  const envApiKey = process.env.GOOGLE_API_KEY;
  if (envApiKey && envApiKey.trim()) {
    return { token: envApiKey.trim(), isApiKey: true };
  }

  // 4. Finally, try standard service account if available in system environment
  const token = await getGoogleAccessToken();
  if (token) {
    return { token, isApiKey: false };
  }

  return null;
};

const ensureSheetExists = async (token: string, spreadsheetId: string, title: string) => {
  try {
    if (!token) return;
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

const fetchProjectsFromSheets = async (auth: { token: string; isApiKey: boolean }, spreadsheetId: string, sheetName: string = "Projects_Mapping"): Promise<any[][]> => {
  const cleanId = spreadsheetId.trim();
  const range = encodeURIComponent(`${sheetName}!A1:Z1000`);
  const url = auth.isApiKey
    ? `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${range}?key=${auth.token}`
    : `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${range}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (!auth.isApiKey) {
    headers["Authorization"] = `Bearer ${auth.token}`;
  }

  const res = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Sheets fetch projects API returned ${res.status}: ${text}`);
  }

  const data: any = await res.json();
  return data.values || [];
};

const seedProjectsToSheets = async (token: string, spreadsheetId: string, sheetName: string = "Projects_Mapping") => {
  if (!token) return;
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

const syncProjects = async (auth: { token: string; isApiKey: boolean }, spreadsheetId: string, sheetName: string = "Projects_Mapping") => {
  try {
    if (!auth.isApiKey) {
      await ensureSheetExists(auth.token, spreadsheetId, sheetName);
    }
    let rows = await fetchProjectsFromSheets(auth, spreadsheetId, sheetName);
    
    if (rows.length <= 1 && !auth.isApiKey) {
      console.log(`Projects sheet "${sheetName}" is empty, seeding defaults...`);
      await seedProjectsToSheets(auth.token, spreadsheetId, sheetName);
      rows = await fetchProjectsFromSheets(auth, spreadsheetId, sheetName);
    }

    const headers = rows[0] || [];
    const normalizedHeaders = headers.map((h: string) => h.toLowerCase().trim());

    // Auto-detect index of each expected column to fully tolerate column variations
    const colIdx = {
      domain: normalizedHeaders.findIndex(h => h.includes('domain') || h.includes('website') || h.includes('url') || h.includes('link')),
      name: normalizedHeaders.findIndex(h => h.includes('project') || h.includes('name') || h === 'title'),
      location: normalizedHeaders.findIndex(h => h.includes('location') || h.includes('city') || h.includes('office')),
      region: normalizedHeaders.findIndex(h => h.includes('region') || h.includes('zone') || h === 'area'),
      users: normalizedHeaders.findIndex(h => h.includes('users') || h.includes('assign') || h.includes('member') || h.includes('staff') || h.includes('employee')),
      userId: normalizedHeaders.findIndex(h => h.includes('user id') || h.includes('userid') || h.includes('employee id') || h.includes('staff id') || h === 'uid' || h === 'id')
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
      const userId = getVal(colIdx.userId);
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
        userId,
        description,
        priority,
        frequency,
        keywords
      };
    }).filter((p: any) => p.name);

    // Deduplicate and merge projects by id
    const deduplicatedMap = new Map<string, any>();
    mapped.forEach((p: any) => {
      if (deduplicatedMap.has(p.id)) {
        const existing = deduplicatedMap.get(p.id);
        const combinedUsers = Array.from(new Set([
          ...(existing.users || []),
          ...(p.users || [])
        ].map(u => String(u).trim().toLowerCase())));
        const combinedKeywords = Array.from(new Set([
          ...(existing.keywords || []),
          ...(p.keywords || [])
        ].map(k => String(k).trim())));

        deduplicatedMap.set(p.id, {
          ...existing,
          ...p,
          users: combinedUsers,
          keywords: combinedKeywords.slice(0, 8),
          location: existing.location !== "Mumbai" ? existing.location : p.location,
          region: existing.region !== "West" ? existing.region : p.region,
          userId: existing.userId || p.userId
        });
      } else {
        deduplicatedMap.set(p.id, p);
      }
    });

    const deduplicatedList = Array.from(deduplicatedMap.values());
    fs.writeFileSync(PROJECTS_FALLBACK_FILE, JSON.stringify(deduplicatedList, null, 2));
    return deduplicatedList;
  } catch (err) {
    console.error("❌ Error syncing projects from Google Sheets, using local cache:", err);
    if (fs.existsSync(PROJECTS_FALLBACK_FILE)) {
      return JSON.parse(fs.readFileSync(PROJECTS_FALLBACK_FILE, "utf-8"));
    }
    return defaultProjects;
  }
};

const fetchSubmissionsFromSheets = async (auth: { token: string; isApiKey: boolean }, spreadsheetId: string, sheetName: string = "DSR_Logs"): Promise<any[][]> => {
  if (!auth.isApiKey) {
    await ensureSheetExists(auth.token, spreadsheetId, sheetName);
  }
  const cleanId = spreadsheetId.trim();
  const range = encodeURIComponent(`${sheetName}!A1:Z5000`);
  const url = auth.isApiKey
    ? `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${range}?key=${auth.token}`
    : `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${range}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (!auth.isApiKey) {
    headers["Authorization"] = `Bearer ${auth.token}`;
  }

  const res = await fetch(url, {
    method: "GET",
    headers
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

const syncSubmissions = async (auth: { token: string; isApiKey: boolean }, spreadsheetId: string, sheetName: string = "DSR_Logs") => {
  try {
    const rows = await fetchSubmissionsFromSheets(auth, spreadsheetId, sheetName);
    
    if (rows.length === 0 && !auth.isApiKey) {
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
          Authorization: `Bearer ${auth.token}`,
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

const syncAlerts = async (auth: any, spreadsheetId: string): Promise<any[]> => {
  const sheetName = "System_Alerts";
  try {
    if (!auth || !spreadsheetId) {
      if (fs.existsSync(ALERTS_FALLBACK_FILE)) {
        return JSON.parse(fs.readFileSync(ALERTS_FALLBACK_FILE, "utf-8"));
      }
      return [];
    }

    if (!auth.isApiKey) {
      await ensureSheetExists(auth.token, spreadsheetId, sheetName);
    }

    const range = encodeURIComponent(`${sheetName}!A2:K1000`);
    const url = auth.isApiKey
      ? `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${auth.token}`
      : `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;

    const res = await fetch(url, {
      headers: auth.isApiKey ? {} : { Authorization: `Bearer ${auth.token}` }
    });

    if (res.ok) {
      const data: any = await res.json();
      const rows = data.values || [];
      const list = rows.map((r: any) => ({
        id: r[0] || `alert-${Date.now()}`,
        alertType: r[1] || 'sticky_note',
        userEmail: r[2] || '',
        projectId: r[3] || '',
        projectName: r[4] || '',
        projectDomain: r[5] || '',
        date: r[6] || '',
        message: r[7] || '',
        adminEmail: r[8] || '',
        createdAt: r[9] || new Date().toISOString(),
        read: r[10] === 'true'
      }));
      fs.writeFileSync(ALERTS_FALLBACK_FILE, JSON.stringify(list, null, 2));
      return list;
    }
  } catch (err) {
    console.error("Failed fetching alerts from sheet:", err);
  }

  if (fs.existsSync(ALERTS_FALLBACK_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(ALERTS_FALLBACK_FILE, "utf-8"));
    } catch {
      return [];
    }
  }
  return [];
};

const writeAllAlertsToSheet = async (token: string, spreadsheetId: string, list: any[]) => {
  const sheetName = "System_Alerts";
  try {
    await ensureSheetExists(token, spreadsheetId, sheetName);
    const headers = [
      "ID",
      "Alert Type",
      "User Email",
      "Project ID",
      "Project Name",
      "Project Domain",
      "Date",
      "Message",
      "Admin Email",
      "Created At",
      "Read"
    ];
    const rows = [
      headers,
      ...list.map(a => [
        a.id || '',
        a.alertType || 'sticky_note',
        a.userEmail || '',
        a.projectId || '',
        a.projectName || '',
        a.projectDomain || '',
        a.date || '',
        a.message || '',
        a.adminEmail || '',
        a.createdAt || '',
        String(!!a.read)
      ])
    ];

    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${sheetName}!A1:K1000`)}:clear`;
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
  } catch (err) {
    console.error("Failed writing alerts to sheet:", err);
  }
};

const logActivityToSheet = async (req: any, email: string, eventType: string, details: string) => {
  try {
    const activity = {
      id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
      userEmail: email,
      eventType,
      details,
      platform: "Web App"
    };

    let list: any[] = [];
    if (fs.existsSync(ACTIVITIES_FALLBACK_FILE)) {
      try {
        list = JSON.parse(fs.readFileSync(ACTIVITIES_FALLBACK_FILE, "utf-8"));
      } catch (err) {}
    }
    list.unshift(activity); // most recent first
    if (list.length > 500) list = list.slice(0, 500); // cap at 500
    fs.writeFileSync(ACTIVITIES_FALLBACK_FILE, JSON.stringify(list, null, 2));

    const auth = await getGoogleAuth(req);
    const spreadsheetId = getSpreadsheetId(req, 'logs');
    const sheetName = "Activity_Logs";
    if (auth && spreadsheetId && !auth.isApiKey) {
      await ensureSheetExists(auth.token, spreadsheetId, sheetName);
      const values = [[
        activity.timestamp,
        activity.userEmail,
        activity.eventType,
        activity.details,
        activity.platform
      ]];
      const range = encodeURIComponent(`${sheetName}!A1`);
      // check headers
      const checkRangeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${sheetName}!A1:E1`)}`;
      const checkRes = await fetch(checkRangeUrl, {
        headers: { Authorization: `Bearer ${auth.token}` }
      });
      let headersExist = false;
      if (checkRes.ok) {
        const checkData: any = await checkRes.json();
        if (checkData.values && checkData.values.length > 0) {
          headersExist = true;
        }
      }
      if (!headersExist) {
        // write header first
        const headersValue = [["Timestamp", "User Email", "Event Type", "Event Details", "Platform"]];
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${sheetName}!A1`)}?valueInputOption=USER_ENTERED`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${auth.token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ values: headersValue })
        });
      }

      const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`;
      await fetch(appendUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ values })
      });
    }
  } catch (err) {
    console.error("Failed to log activity to Google Sheet:", err);
  }
};

const syncActivityLogs = async (auth: any, spreadsheetId: string): Promise<any[]> => {
  const sheetName = "Activity_Logs";
  try {
    if (!auth || !spreadsheetId) {
      if (fs.existsSync(ACTIVITIES_FALLBACK_FILE)) {
        return JSON.parse(fs.readFileSync(ACTIVITIES_FALLBACK_FILE, "utf-8"));
      }
      return [];
    }

    if (!auth.isApiKey) {
      await ensureSheetExists(auth.token, spreadsheetId, sheetName);
    }

    const range = encodeURIComponent(`${sheetName}!A2:E502`);
    const url = auth.isApiKey
      ? `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${auth.token}`
      : `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;

    const res = await fetch(url, {
      headers: auth.isApiKey ? {} : { Authorization: `Bearer ${auth.token}` }
    });

    if (res.ok) {
      const data: any = await res.json();
      const rows = data.values || [];
      const list = rows.map((r: any, idx: number) => ({
        id: `act-sync-${idx}`,
        timestamp: r[0] || new Date().toISOString(),
        userEmail: r[1] || "",
        eventType: r[2] || "",
        details: r[3] || "",
        platform: r[4] || "Web App"
      }));
      // sort most recent first
      list.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      if (list.length > 0) {
        fs.writeFileSync(ACTIVITIES_FALLBACK_FILE, JSON.stringify(list, null, 2));
      }
      return list;
    }
  } catch (err) {
    console.error("Failed syncing activity logs from sheet:", err);
  }

  if (fs.existsSync(ACTIVITIES_FALLBACK_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(ACTIVITIES_FALLBACK_FILE, "utf-8"));
    } catch {
      return [];
    }
  }
  return [];
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

try {
  if (!fs.existsSync(ACTIVITIES_FALLBACK_FILE)) {
    fs.writeFileSync(ACTIVITIES_FALLBACK_FILE, JSON.stringify([], null, 2));
  }
} catch (e) {
  console.error("Warning: Could not seed ACTIVITIES_FALLBACK_FILE:", e);
}

// 3. User Authorization Registry (Backend Lists)
const ALLOWED_ADMINS = [
  "vatsalpatel1720@gmail.com",
  "vatsalpatelwork20@gmail.com"
];

const ALLOWED_USERS = [
  "vatsal.assetscout@gmail.com",
  "vatsalpatel1720@gmail.com",
  "vatsalpatelwork20@gmail.com"
];

// ==========================================
// API ENDPOINTS
// ==========================================

const isUserAdmin = (email: string): boolean => {
  if (!email) return false;
  const emailLower = email.trim().toLowerCase();
  if (emailLower.includes("admin")) return true;
  if (ALLOWED_ADMINS.some(adm => adm.toLowerCase() === emailLower)) return true;
  return false;
};

const cleanEmailToNameOrUsername = (email: string): string => {
  if (!email) return "";
  const emailLower = email.trim().toLowerCase();
  if (emailLower.includes('@')) {
    return emailLower.split('@')[0];
  }
  return emailLower;
};

// GET Auth configurations for sync
app.get("/api/auth/config", (req, res) => {
  const filteredUsers = ALLOWED_USERS
    .filter(u => !isUserAdmin(u))
    .map(u => cleanEmailToNameOrUsername(u));

  res.json({
    allowedAdmins: ALLOWED_ADMINS,
    allowedUsers: filteredUsers
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

  const filteredUsers = ALLOWED_USERS
    .filter(u => !isUserAdmin(u))
    .map(u => cleanEmailToNameOrUsername(u));

  logActivityToSheet(req, emailLower, "User Login", `Successfully logged in as ${isAdmin ? "Admin" : "Standard Employee"}`);

  return res.json({
    allowed: true,
    role: isAdmin ? "admin" : "user",
    allowedAdmins: ALLOWED_ADMINS,
    allowedUsers: filteredUsers
  });
});

const getSpreadsheetId = (req: any, type: 'projects' | 'logs'): string | null => {
  // 0. Check directly hardcoded Spreadsheet ID first
  if (DIRECT_SPREADSHEET_ID && DIRECT_SPREADSHEET_ID.trim()) {
    return DIRECT_SPREADSHEET_ID.trim();
  }

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

const getProjectsTab = (req: any): string => {
  if (DIRECT_PROJECTS_SHEET_NAME && DIRECT_PROJECTS_SHEET_NAME.trim()) {
    return DIRECT_PROJECTS_SHEET_NAME.trim();
  }
  return (req.headers['x-projects-tab'] as string) || "Projects_Mapping";
};

const getSubmissionsTab = (req: any): string => {
  if (DIRECT_DSR_LOGS_SHEET_NAME && DIRECT_DSR_LOGS_SHEET_NAME.trim()) {
    return DIRECT_DSR_LOGS_SHEET_NAME.trim();
  }
  return (req.headers['x-submissions-tab'] as string) || "DSR_Logs";
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
    const auth = await getGoogleAuth(req);
    const spreadsheetId = getSpreadsheetId(req, 'projects');
    const projectsTab = getProjectsTab(req);

    let list = [];
    if (auth && spreadsheetId) {
      list = await syncProjects(auth, spreadsheetId, projectsTab);
    } else {
      list = JSON.parse(fs.readFileSync(PROJECTS_FALLBACK_FILE, "utf-8"));
    }

    // Filter projects for non-admins if x-user-email is passed
    const clientUserEmail = req.headers['x-user-email'];
    const clientUserRole = req.headers['x-user-role'];
    if (clientUserEmail && typeof clientUserEmail === 'string' && clientUserRole !== 'admin') {
      const emailLower = clientUserEmail.trim().toLowerCase();
      list = list.filter((p: any) => {
        const assigned = Array.isArray(p.users) ? p.users : [];
        return assigned.some((u: string) => u.trim().toLowerCase() === emailLower);
      });
    }

    return res.json(list);
  } catch (err: any) {
    console.error("GET /api/projects error:", err);
    try {
      let list = JSON.parse(fs.readFileSync(PROJECTS_FALLBACK_FILE, "utf-8"));
      const clientUserEmail = req.headers['x-user-email'];
      const clientUserRole = req.headers['x-user-role'];
      if (clientUserEmail && typeof clientUserEmail === 'string' && clientUserRole !== 'admin') {
        const emailLower = clientUserEmail.trim().toLowerCase();
        list = list.filter((p: any) => {
          const assigned = Array.isArray(p.users) ? p.users : [];
          return assigned.some((u: string) => u.trim().toLowerCase() === emailLower);
        });
      }
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

    const auth = await getGoogleAuth(req);
    const spreadsheetId = getSpreadsheetId(req, 'projects');
    const projectsTab = (req.headers['x-projects-tab'] as string) || "Projects_Mapping";
    if (auth && spreadsheetId && !auth.isApiKey) {
      await writeAllProjectsToSheets(auth.token, spreadsheetId, list, projectsTab);
    }

    const userEmail = req.headers['x-user-email'] || "Admin";
    await logActivityToSheet(req, String(userEmail), `${action === 'add' ? 'CREATE' : action === 'edit' ? 'EDIT' : 'DELETE'} Project`, `${action === 'add' ? 'Created' : action === 'edit' ? 'Edited' : 'Deleted'} project: "${project?.name || project?.domain || 'unnamed'}"`);

    return res.json({ success: true, list });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET filters combinations
app.get("/api/filters", async (req, res) => {
  try {
    let projectsArr = [];
    const auth = await getGoogleAuth(req);
    const spreadsheetId = getSpreadsheetId(req, 'projects');
    const projectsTab = getProjectsTab(req);
    const submissionsTab = getSubmissionsTab(req);

    if (auth && spreadsheetId) {
      projectsArr = await syncProjects(auth, spreadsheetId, projectsTab);
    } else {
      try {
        projectsArr = JSON.parse(fs.readFileSync(PROJECTS_FALLBACK_FILE, "utf-8"));
      } catch {
        projectsArr = [...defaultProjects];
      }
    }

    // Filter projects for non-admins if x-user-email is passed
    const clientUserEmail = req.headers['x-user-email'];
    const clientUserRole = req.headers['x-user-role'];
    if (clientUserEmail && typeof clientUserEmail === 'string' && clientUserRole !== 'admin') {
      const emailLower = clientUserEmail.trim().toLowerCase();
      projectsArr = projectsArr.filter((p: any) => {
        return p.userId && String(p.userId).trim().toLowerCase() === emailLower;
      });
    }

    const uniqueLocations = new Set<string>();
    const uniqueRegions = new Set<string>();
    const userMap = new Map<string, string>();

    const formatUserEmailToName = (email: string): string => {
      if (!email) return "";
      let clean = email.trim();
      if (clean.includes("@")) {
        clean = clean.split("@")[0];
      }
      if (clean.includes(".") || clean.includes("-") || clean.includes("_")) {
        return clean
          .split(/[\._-]/)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
      }
      return clean.charAt(0).toUpperCase() + clean.slice(1);
    };

    projectsArr.forEach((p: any) => {
      if (p.location) uniqueLocations.add(p.location);
      if (p.region) uniqueRegions.add(p.region);
      if (p.userId && String(p.userId).trim()) {
        const uId = String(p.userId).trim().toLowerCase();
        if (!isUserAdmin(uId)) {
          let assignedName = "";
          if (p.users && Array.isArray(p.users) && p.users.length > 0) {
            assignedName = p.users.find((u: string) => !/^\d+$/.test(u.trim())) || p.users[0];
          }
          if (!assignedName) {
            assignedName = formatUserEmailToName(uId);
          }
          const formattedName = assignedName
            .split(' ')
            .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
          
          userMap.set(uId, formattedName);
        }
      }
    });

    let submissionsArr = [];
    const logsSpreadsheetId = getSpreadsheetId(req, 'logs');

    if (auth && logsSpreadsheetId) {
      submissionsArr = await syncSubmissions(auth, logsSpreadsheetId, submissionsTab);
    } else {
      try {
        submissionsArr = JSON.parse(fs.readFileSync(SUBMISSIONS_FALLBACK_FILE, "utf-8"));
      } catch {
        submissionsArr = [...defaultSubmissions];
      }
    }

    submissionsArr.forEach((entry: any) => {
      if (entry.userEmail) {
        const userStr = entry.userEmail.trim().toLowerCase();
        if (userStr && !isUserAdmin(userStr)) {
          if (!userMap.has(userStr)) {
            userMap.set(userStr, formatUserEmailToName(userStr));
          }
        }
      }
    });

    if (uniqueRegions.size === 0) {
      uniqueRegions.add("North");
      uniqueRegions.add("West");
      uniqueRegions.add("South");
    }

    const finalUsers = Array.from(userMap.entries()).map(([emailStr, nameStr]) => {
      return {
        email: emailStr,
        name: nameStr
      };
    }).sort((a, b) => a.name.localeCompare(b.name));

    return res.json({
      projects: projectsArr,
      locations: [], // Empty locations so they are removed from the location dropdown
      regions: Array.from(uniqueRegions).sort(),
      users: finalUsers
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET Submissions Logs
app.get("/api/submissions", async (req, res) => {
  try {
    const auth = await getGoogleAuth(req);
    const spreadsheetId = getSpreadsheetId(req, 'logs');
    const submissionsTab = getSubmissionsTab(req);

    if (auth && spreadsheetId) {
      const list = await syncSubmissions(auth, spreadsheetId, submissionsTab);
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

    const auth = await getGoogleAuth(req);
    const spreadsheetId = getSpreadsheetId(req, 'logs');
    const submissionsTab = getSubmissionsTab(req);

    if (auth && spreadsheetId && !auth.isApiKey) {
      const sheetName = submissionsTab;
      await ensureSheetExists(auth.token, spreadsheetId, sheetName);

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
          Authorization: `Bearer ${auth.token}`,
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

    await logActivityToSheet(req, userEmail, "DSR Submission", `Submitted Work Log for date ${date} containing ${works.length} project block(s).`);

    return res.json({ success: true, source: auth && spreadsheetId ? (auth.isApiKey ? "Local Fallback Cache (Google API Key active for read)" : "Google Sheets + Local Backup") : "Local File DB Only" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Clear logs/submissions restriction
app.delete("/api/submissions", (req, res) => {
  return res.status(403).json({ error: "Logs cannot be deleted from history." });
});

// GET Alerts
app.get("/api/alerts", async (req, res) => {
  try {
    const auth = await getGoogleAuth(req);
    const spreadsheetId = getSpreadsheetId(req, 'logs');
    if (auth && spreadsheetId) {
      const list = await syncAlerts(auth, spreadsheetId);
      return res.json(list);
    }
    const list = JSON.parse(fs.readFileSync(ALERTS_FALLBACK_FILE, "utf-8"));
    res.json(list);
  } catch {
    res.json([]);
  }
});

// POST alert notifications to admin
app.post("/api/alerts", async (req, res) => {
  const { alert } = req.body;
  if (!alert) {
    return res.status(400).json({ error: "Missing alert data" });
  }

  try {
    const list = JSON.parse(fs.readFileSync(ALERTS_FALLBACK_FILE, "utf-8"));
    list.unshift(alert);
    fs.writeFileSync(ALERTS_FALLBACK_FILE, JSON.stringify(list, null, 2));

    const auth = await getGoogleAuth(req);
    const spreadsheetId = getSpreadsheetId(req, 'logs');
    if (auth && spreadsheetId && !auth.isApiKey) {
      await writeAllAlertsToSheet(auth.token, spreadsheetId, list);
    }

    // Capture activity
    const adminEmail = req.headers['x-user-email'] || alert.adminEmail || "Admin";
    await logActivityToSheet(req, String(adminEmail), "Create Note/Assignment", `Created notification assignment for ${alert.userEmail || 'all workers'} on project "${alert.projectName || alert.projectDomain || 'All'}"`);

    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST Clear/Dismiss alerts
app.post("/api/alerts/clear", async (req, res) => {
  const { id, all } = req.body;
  try {
    let list = JSON.parse(fs.readFileSync(ALERTS_FALLBACK_FILE, "utf-8"));
    const clearedItem = id ? list.find((a: any) => a.id === id) : null;
    if (all) {
      list = list.map((a: any) => ({ ...a, read: true }));
    } else if (id) {
      list = list.filter((a: any) => a.id !== id);
    }
    fs.writeFileSync(ALERTS_FALLBACK_FILE, JSON.stringify(list, null, 2));

    const auth = await getGoogleAuth(req);
    const spreadsheetId = getSpreadsheetId(req, 'logs');
    if (auth && spreadsheetId && !auth.isApiKey) {
      await writeAllAlertsToSheet(auth.token, spreadsheetId, list);
    }

    // Capture activity
    const actorEmail = req.headers['x-user-email'] || "User";
    await logActivityToSheet(req, String(actorEmail), "Clear Note/Assignment", all ? "Cleared all active stick-notes and assignments" : `Cleared notification assignment: "${clearedItem?.message || id}"`);

    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET Activity Logs
app.get("/api/activity", async (req, res) => {
  try {
    const auth = await getGoogleAuth(req);
    const spreadsheetId = getSpreadsheetId(req, 'logs');
    if (auth && spreadsheetId) {
      const list = await syncActivityLogs(auth, spreadsheetId);
      return res.json(list);
    }
    
    if (fs.existsSync(ACTIVITIES_FALLBACK_FILE)) {
      const list = JSON.parse(fs.readFileSync(ACTIVITIES_FALLBACK_FILE, "utf-8"));
      return res.json(list);
    }
    res.json([]);
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
