import { useState, useEffect, useCallback, useRef } from "react";

// ─── Supabase Config ──────────────────────────────────────────────────────────
const SUPABASE_URL = "https://xgvmjhmdnjxgdhsijnkq.supabase.co";
const SUPABASE_KEY = "sb_publishable_avPJYYyJmCp-atCDy-MxYw_CbUhXdML";

// Lightweight Supabase client (no SDK needed)
const sb = {
  headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", "Prefer": "return=representation" },
  url: (table, params = "") => `${SUPABASE_URL}/rest/v1/${table}${params}`,

  async get(table, params = "") {
    const r = await fetch(this.url(table, params), { headers: this.headers });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async post(table, body) {
    const r = await fetch(this.url(table), { method: "POST", headers: this.headers, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async patch(table, id, body) {
    const r = await fetch(this.url(table, `?id=eq.${id}`), { method: "PATCH", headers: { ...this.headers, "Prefer": "return=representation" }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async delete(table, id) {
    const r = await fetch(this.url(table, `?id=eq.${id}`), { method: "DELETE", headers: this.headers });
    if (!r.ok) throw new Error(await r.text());
  },

  // Realtime via Supabase websocket
  subscribe(table, callback) {
    const wsUrl = `${SUPABASE_URL.replace("https", "wss")}/realtime/v1/websocket?apikey=${SUPABASE_KEY}&vsn=1.0.0`;
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({ topic: `realtime:public:${table}`, event: "phx_join", payload: {}, ref: "1" }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.event === "INSERT" || msg.event === "UPDATE" || msg.event === "DELETE") {
        callback(msg.event, msg.payload?.record, msg.payload?.old_record);
      }
    };
    return () => ws.close();
  },

  // Auth
  async signUp(email, password) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: "POST",
      headers: { "apikey": SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.msg || data.error_description || "Sign up failed");
    return data;
  },

  async signIn(email, password) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "apikey": SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.msg || data.error_description || "Sign in failed");
    return data; // { access_token, user, ... }
  },

  async signOut(token) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` },
    });
  },

  async getUser(token) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` },
    });
    if (!r.ok) return null;
    return r.json();
  },
};

// ── Email → team member mapping (login locks you in as yourself) ──────────────
const EMAIL_TO_MEMBER = {
  "abigail@abigailswihart.com":  "u1",
  "billruffnerhomes@gmail.com":  "u2",
  "mfrenchhomes@gmail.com":      "u3",
  "toby@spadecustomhomes.com":   "u4",
  "mark@zollingerbuilders.com":  "u5",
  "jock@zollingerbuilders.com":  "u6",
  "heather@abigailswihart.com":  "u7",
};


// ─── Constants ────────────────────────────────────────────────────────────────

const STAGES = [
  "New Inquiry",
  "Initial Consult Complete",
  "Meeting Scheduled",
  "Meeting Complete",
  "Proposal Sent",
  "In Negotiation",
  "Contract Signed",
  "In Progress",
  "Completed",
  "Lost / No Sale",
];

const STAGE_META = {
  "New Inquiry":               { color: "#64748b", bg: "#f1f5f9", track: 1  },
  "Initial Consult Complete":  { color: "#7c3aed", bg: "#ede9fe", track: 3  },
  "Meeting Scheduled":         { color: "#0369a1", bg: "#dbeafe", track: 4  },
  "Meeting Complete":          { color: "#6d28d9", bg: "#ede9fe", track: 5  },
  "Proposal Sent":             { color: "#d97706", bg: "#fef3c7", track: 6  },
  "In Negotiation":            { color: "#ea580c", bg: "#fff7ed", track: 7  },
  "Contract Signed":           { color: "#16a34a", bg: "#dcfce7", track: 8  },
  "In Progress":               { color: "#0369a1", bg: "#e0f2fe", track: 9  },
  "Completed":                 { color: "#15803d", bg: "#bbf7d0", track: 10 },
  "Lost / No Sale":            { color: "#94a3b8", bg: "#f1f5f9", track: 0  },
};

const PROJECT_TYPES = [
  "Build a Barndominium",
  "Purchase a Barndominium",
  "Build + Purchase (Combined)",
  "Undecided",
];

const LEAD_SOURCES = [
  "ASAP",
  "Within 3 months",
  "3–6 months",
  "6–12 months",
  "1–2 years",
  "Just exploring",
];

const TAGS = [
  "Hot Lead",
  "Has Property",
  "Needs Property",
  "Financing Ready",
  "Tight Timeline",
  "Follow Up",
  "Price Sensitive",
  "Columbus Region",
  "Wooster Region",
];

const OHIO_REGIONS = [
  "Central Ohio (Columbus)",
  "Northeast Ohio (Wooster / Akron)",
  "Northwest Ohio (Toledo)",
  "Southeast Ohio",
  "Southwest Ohio (Cincinnati)",
  "Other / Not Sure",
];

const DEFAULT_TEAM = [
  { id: "u1", name: "Abigail Swihart",  role: "Sales Rep",             initials: "AS", color: "#dc2626", email: "abigail@abigailswihart.com" },
  { id: "u2", name: "Bill Ruffner",     role: "Sales Rep",             initials: "BR", color: "#ea580c", email: "billruffnerhomes@gmail.com"  },
  { id: "u3", name: "Michelle French",  role: "Sales Rep",             initials: "MF", color: "#9333ea", email: "mfrenchhomes@gmail.com"       },
  { id: "u4", name: "Toby Spade",       role: "Developer — Columbus",  initials: "TS", color: "#0369a1", email: "toby@spadecustomhomes.com"   },
  { id: "u5", name: "Mark Zollinger",   role: "Developer — Wooster",   initials: "MZ", color: "#15803d", email: "mark@zollingerbuilders.com"  },
  { id: "u6", name: "Jock Zollinger",   role: "Developer — Wooster",   initials: "JZ", color: "#0d9488", email: "jock@zollingerbuilders.com"  },
  { id: "u7", name: "Heather Angeny",   role: "Sales Rep",             initials: "HA", color: "#7c3aed", email: "heather@abigailswihart.com"  },
];

const SAMPLE_LEADS = [
  {
    id: "1fcchzn0",
    name: "Riley Boeddeker",
    company: "",
    email: "rileytboeddeker@gmail.com",
    phone: "(513) 593-4757",
    projectType: "Build a Barndominium",
    stage: "New Inquiry",
    value: 0,
    source: "In the next 12 months",
    assignedTo: "u4",
    salesRep: "u3",
    region: "Southwest Ohio (Cincinnati)",
    hasProperty: "Yes",
    budget: "$300k - $500k",
    tags: [],
    notes: [],
    createdAt: "2025-09-25T00:00:00",
    fromSheets: false,
  },
  {
    id: "e0okfhtt",
    name: "Don Moore",
    company: "",
    email: "dmoore@ohioacs.com",
    phone: "(614) 745-9318",
    projectType: "Build a Barndominium",
    stage: "Initial Consult Complete",
    value: 0,
    source: "In the next 12 months",
    assignedTo: "u4",
    salesRep: "u3",
    region: "Central Ohio (Columbus)",
    hasProperty: "Yes",
    budget: "Under $300k",
    tags: [],
    notes: [],
    createdAt: "2025-09-26T00:00:00",
    fromSheets: false,
  },
  {
    id: "svmkoido",
    name: "Tyler Less",
    company: "",
    email: "tigerl0128@aol.com",
    phone: "(330) 692-8660",
    projectType: "Build a Barndominium",
    stage: "New Inquiry",
    value: 0,
    source: "In the next 12 months",
    assignedTo: "u4",
    salesRep: "u3",
    region: "Central Ohio (Columbus)",
    hasProperty: "Yes",
    budget: "Under $300k",
    tags: [],
    notes: [],
    createdAt: "2025-07-18T00:00:00",
    fromSheets: false,
  },
  {
    id: "xqbugm5s",
    name: "Daniel Sergent",
    company: "",
    email: "danielsergent@yahoo.com",
    phone: "(513) 264-4640",
    projectType: "Build a Barndominium",
    stage: "New Inquiry",
    value: 0,
    source: "In the next 12 months",
    assignedTo: "u4",
    salesRep: "u3",
    region: "Southwest Ohio (Cincinnati)",
    hasProperty: "Yes",
    budget: "Under $300k",
    tags: [],
    notes: [],
    createdAt: "2025-07-02T00:00:00",
    fromSheets: false,
  },
  {
    id: "m7x4b316",
    name: "Renata Bowlden",
    company: "",
    email: "renatabowlden@gmail.com",
    phone: "(253) 460-1885",
    projectType: "Build a Barndominium",
    stage: "New Inquiry",
    value: 0,
    source: "In the next 12 months",
    assignedTo: "u4",
    salesRep: "u3",
    region: "Southwest Ohio (Cincinnati)",
    hasProperty: "Yes",
    budget: "$300k - $500k",
    tags: [],
    notes: [],
    createdAt: "2025-06-10T00:00:00",
    fromSheets: false,
  },
  {
    id: "m70k08y4",
    name: "Stephanie Harmon",
    company: "",
    email: "sharmon2828@aol.com",
    phone: "(419) 356-7957",
    projectType: "Build a Barndominium",
    stage: "New Inquiry",
    value: 0,
    source: "In the next 12 months",
    assignedTo: "u4",
    salesRep: "u3",
    region: "Central Ohio (Columbus)",
    hasProperty: "No",
    budget: "$300k - $500k",
    tags: [],
    notes: [],
    createdAt: "2025-12-03T00:00:00",
    fromSheets: false,
  },
  {
    id: "498pr2l7",
    name: "Joel Gardner",
    company: "",
    email: "joel.l.gardner@gmail.com",
    phone: "(614) 779-2592",
    projectType: "Build a Barndominium",
    stage: "Initial Consult Complete",
    value: 0,
    source: "ASAP",
    assignedTo: "u4",
    salesRep: "u3",
    region: "Central Ohio (Columbus)",
    hasProperty: "Yes",
    budget: "Under $300k",
    tags: [],
    notes: [],
    createdAt: "2025-12-06T00:00:00",
    fromSheets: false,
  },
  {
    id: "01musjkf",
    name: "Will Hagerman",
    company: "",
    email: "willhagermanthe3@gmail.com",
    phone: "(740) 281-8644",
    projectType: "Build a Barndominium",
    stage: "Initial Consult Complete",
    value: 0,
    source: "In the next 12 months",
    assignedTo: "u4",
    salesRep: "u3",
    region: "Central Ohio (Columbus)",
    hasProperty: "No",
    budget: "Under $300k",
    tags: [],
    notes: [],
    createdAt: "2025-12-07T00:00:00",
    fromSheets: false,
  },
  {
    id: "svxhqbap",
    name: "Dani Drum",
    company: "",
    email: "denaya_drum@yahoo.com",
    phone: "(740) 601-2979",
    projectType: "Build a Barndominium",
    stage: "New Inquiry",
    value: 0,
    source: "In the next 12 months",
    assignedTo: "u4",
    salesRep: "u3",
    region: "Southeast Ohio",
    hasProperty: "Yes",
    budget: "Under $300k",
    tags: [],
    notes: [],
    createdAt: "2025-12-07T00:00:00",
    fromSheets: false,
  },
  {
    id: "efaizgjl",
    name: "Tony Paulson",
    company: "",
    email: "paulson1279@gmail.com",
    phone: "(763) 592-9291",
    projectType: "Build a Barndominium",
    stage: "New Inquiry",
    value: 0,
    source: "ASAP",
    assignedTo: "u4",
    salesRep: "u3",
    region: "Southeast Ohio",
    hasProperty: "Yes",
    budget: "$300k - $500k",
    tags: [],
    notes: [],
    createdAt: "2025-12-22T00:00:00",
    fromSheets: false,
  },
  {
    id: "7hacpzbz",
    name: "Patrick D Sadongo",
    company: "",
    email: "psadongo@yahoo.com",
    phone: "(614) 586-2969",
    projectType: "Build a Barndominium",
    stage: "Initial Consult Complete",
    value: 0,
    source: "In the next 12 months",
    assignedTo: "u4",
    salesRep: "u3",
    region: "Central Ohio (Columbus)",
    hasProperty: "Yes",
    budget: "$300k - $500k",
    tags: [],
    notes: [],
    createdAt: "2025-12-23T00:00:00",
    fromSheets: false,
  },
  {
    id: "wyfgq4mg",
    name: "Alex Gillespie",
    company: "",
    email: "agillespie2011@gmail.com",
    phone: "(937) 307-2603",
    projectType: "Build a Barndominium",
    stage: "New Inquiry",
    value: 0,
    source: "In the next 12 months",
    assignedTo: "u4",
    salesRep: "u3",
    region: "Southwest Ohio (Cincinnati)",
    hasProperty: "Yes",
    budget: "Under $300k",
    tags: [],
    notes: [],
    createdAt: "2026-01-06T00:00:00",
    fromSheets: false,
  },
  {
    id: "69gsoug0",
    name: "Jennifer Stevens",
    company: "",
    email: "jyostevens@gmail.com",
    phone: "(415) 810-2933",
    projectType: "Build a Barndominium",
    stage: "Initial Consult Complete",
    value: 0,
    source: "ASAP",
    assignedTo: "u4",
    salesRep: "u3",
    region: "Central Ohio (Columbus)",
    hasProperty: "Yes",
    budget: "$500k - $1M",
    tags: [],
    notes: [],
    createdAt: "2026-01-11T00:00:00",
    fromSheets: false,
  },
  {
    id: "5qzv7gg0",
    name: "Carrie Detwiler",
    company: "",
    email: "cedetwiler133@gmail.com",
    phone: "(937) 336-1035",
    projectType: "Build a Barndominium",
    stage: "New Inquiry",
    value: 0,
    source: "ASAP",
    assignedTo: "u4",
    salesRep: "u3",
    region: "Southwest Ohio (Cincinnati)",
    hasProperty: "Yes",
    budget: "$300k - $500k",
    tags: [],
    notes: [],
    createdAt: "2026-01-12T00:00:00",
    fromSheets: false,
  },

  {
    id: "41r0z0gx",
    name: "Jennifer Londo",
    company: "",
    email: "jenniferlondo@hopeworks.co",
    phone: "(440) 714-1538",
    projectType: "Build a Barndominium",
    stage: "New Inquiry",
    value: 0,
    source: "",
    assignedTo: "u5",
    salesRep: "u3",
    region: "Northeast Ohio (Wooster / Akron)",
    hasProperty: "Not sure",
    budget: "",
    tags: [],
    notes: [],
    createdAt: "2025-12-18T00:00:00",
    fromSheets: false,
  },
  {
    id: "bebom0as",
    name: "Pamela J Lockett",
    company: "",
    email: "lockettforever@gmail.com",
    phone: "(330) 990-7060",
    projectType: "Build a Barndominium",
    stage: "New Inquiry",
    value: 0,
    source: "",
    assignedTo: "u5",
    salesRep: "u3",
    region: "Northeast Ohio (Wooster / Akron)",
    hasProperty: "Not sure",
    budget: "",
    tags: [],
    notes: [],
    createdAt: "2025-12-18T00:00:00",
    fromSheets: false,
  },
  {
    id: "zpdr0ns1",
    name: "James D Stachowiak",
    company: "",
    email: "jimkana@zoominternet.net",
    phone: "(330) 242-3201",
    projectType: "Build a Barndominium",
    stage: "Initial Consult Complete",
    value: 0,
    source: "",
    assignedTo: "u5",
    salesRep: "u3",
    region: "Northeast Ohio (Wooster / Akron)",
    hasProperty: "Not sure",
    budget: "",
    tags: [],
    notes: [],
    createdAt: "2025-12-19T00:00:00",
    fromSheets: false,
  },
  {
    id: "mmrzrihy",
    name: "Rachel Metz",
    company: "",
    email: "rme.46732@gmail.com",
    phone: "(440) 591-2792",
    projectType: "Build a Barndominium",
    stage: "Initial Consult Complete",
    value: 0,
    source: "",
    assignedTo: "u5",
    salesRep: "u3",
    region: "Northeast Ohio (Wooster / Akron)",
    hasProperty: "Not sure",
    budget: "",
    tags: [],
    notes: [],
    createdAt: "2025-12-29T00:00:00",
    fromSheets: false,
  },
  {
    id: "e729lv2b",
    name: "JJ Kocevar",
    company: "",
    email: "jkocevar13@gmail.com",
    phone: "(330) 419-3823",
    projectType: "Build a Barndominium",
    stage: "New Inquiry",
    value: 0,
    source: "",
    assignedTo: "u5",
    salesRep: "u3",
    region: "Northeast Ohio (Wooster / Akron)",
    hasProperty: "Not sure",
    budget: "",
    tags: [],
    notes: [],
    createdAt: "2026-01-14T00:00:00",
    fromSheets: false,
  },
  {
    id: "xp8bq4jr",
    name: "Kevin Schiele",
    company: "",
    email: "kevinschiele0625@yahoo.com",
    phone: "(330) 604-1597",
    projectType: "Build a Barndominium",
    stage: "New Inquiry",
    value: 0,
    source: "",
    assignedTo: "u5",
    salesRep: "u3",
    region: "Northeast Ohio (Wooster / Akron)",
    hasProperty: "Not sure",
    budget: "",
    tags: [],
    notes: [],
    createdAt: "2026-02-21T00:00:00",
    fromSheets: false,
  },,
  {
    id: "bxfu8hqk",
    name: "Stephen Butcher",
    company: "",
    email: "stvbtchr@gmail.com",
    phone: "(541) 264-1845",
    projectType: "Build a Barndominium",
    stage: "Initial Consult Complete",
    value: 0,
    source: "ASAP",
    assignedTo: "u4",
    salesRep: "u2",
    region: "Northeast Ohio (Wooster / Akron)",
    hasProperty: "No",
    budget: "$300k - $500k",
    tags: [],
    notes: [],
    createdAt: "2026-01-02T00:00:00",
    fromSheets: false,
  },
  {
    id: "iea6fy5y",
    name: "Kyler Spinks",
    company: "",
    email: "kspinks23@yahoo.com",
    phone: "(740) 624-8640",
    projectType: "Build a Barndominium",
    stage: "New Inquiry",
    value: 0,
    source: "In the next 12 months",
    assignedTo: "u4",
    salesRep: "u2",
    region: "Central Ohio (Columbus)",
    hasProperty: "Yes",
    budget: "Under $300k",
    tags: [],
    notes: [],
    createdAt: "2026-01-02T00:00:00",
    fromSheets: false,
  },
  {
    id: "49dhvfi6",
    name: "Chris Lloyd",
    company: "",
    email: "clloyd3182@gmail.com",
    phone: "(513) 515-3848",
    projectType: "Build a Barndominium",
    stage: "New Inquiry",
    value: 0,
    source: "12+ months out",
    assignedTo: "u4",
    salesRep: "u2",
    region: "Southwest Ohio (Cincinnati)",
    hasProperty: "No",
    budget: "$300k - $500k",
    tags: [],
    notes: [],
    createdAt: "2026-01-05T00:00:00",
    fromSheets: false,
  },
  {
    id: "u2m3g3sm",
    name: "Greg Ross",
    company: "",
    email: "gregory.ross22@gmail.com",
    phone: "(513) 235-5296",
    projectType: "Build a Barndominium",
    stage: "New Inquiry",
    value: 0,
    source: "12+ months out",
    assignedTo: "u4",
    salesRep: "u2",
    region: "Southwest Ohio (Cincinnati)",
    hasProperty: "No",
    budget: "$500k - $1M",
    tags: [],
    notes: [],
    createdAt: "2026-01-05T00:00:00",
    fromSheets: false,
  },
  {
    id: "ne303f6x",
    name: "Cami Beachy",
    company: "",
    email: "camibeachy@gmail.com",
    phone: "(614) 580-6045",
    projectType: "Build a Barndominium",
    stage: "New Inquiry",
    value: 0,
    source: "In the next 12 months",
    assignedTo: "u4",
    salesRep: "u2",
    region: "Central Ohio (Columbus)",
    hasProperty: "No",
    budget: "$300k - $500k",
    tags: [],
    notes: [],
    createdAt: "2026-01-05T00:00:00",
    fromSheets: false,
  },
  {
    id: "ngofneaf",
    name: "Adam Blevins",
    company: "",
    email: "adam@fusionstar.net",
    phone: "(513) 594-0423",
    projectType: "Build a Barndominium",
    stage: "Initial Consult Complete",
    value: 0,
    source: "In the next 12 months",
    assignedTo: "u4",
    salesRep: "u2",
    region: "Southwest Ohio (Cincinnati)",
    hasProperty: "No",
    budget: "$300k - $500k",
    tags: [],
    notes: [],
    createdAt: "2026-01-05T00:00:00",
    fromSheets: false,
  },
  {
    id: "flurnhlf",
    name: "David Zuravel",
    company: "",
    email: "dzuravel@gmail.com",
    phone: "(330) 696-8524",
    projectType: "Build a Barndominium",
    stage: "New Inquiry",
    value: 0,
    source: "In the next 12 months",
    assignedTo: "u4",
    salesRep: "u2",
    region: "Northeast Ohio (Wooster / Akron)",
    hasProperty: "Yes",
    budget: "Under $300k",
    tags: [],
    notes: [],
    createdAt: "2026-01-07T00:00:00",
    fromSheets: false,
  },
  {
    id: "t3xt801m",
    name: "Dave Timmons",
    company: "",
    email: "david.timmons1@gmail.com",
    phone: "(513) 833-4934",
    projectType: "Build a Barndominium",
    stage: "New Inquiry",
    value: 0,
    source: "In the next 12 months",
    assignedTo: "u4",
    salesRep: "u2",
    region: "Southwest Ohio (Cincinnati)",
    hasProperty: "Yes",
    budget: "$300k - $500k",
    tags: [],
    notes: [],
    createdAt: "2026-01-08T00:00:00",
    fromSheets: false,
  },
  {
    id: "rmpckvma",
    name: "Melissa",
    company: "",
    email: "melissa.zedlitz@gmail.com",
    phone: "(937) 243-5371",
    projectType: "Build a Barndominium",
    stage: "Initial Consult Complete",
    value: 0,
    source: "ASAP",
    assignedTo: "u4",
    salesRep: "u2",
    region: "Central Ohio (Columbus)",
    hasProperty: "No",
    budget: "$500k - $1M",
    tags: [],
    notes: [],
    createdAt: "2026-01-10T00:00:00",
    fromSheets: false,
  },
  {
    id: "745nfj9f",
    name: "Annie Oco",
    company: "",
    email: "annie.oco1987@gmail.com",
    phone: "(980) 298-2696",
    projectType: "Build a Barndominium",
    stage: "Meeting Scheduled",
    value: 0,
    source: "12+ months out",
    assignedTo: "u4",
    salesRep: "u2",
    region: "Central Ohio (Columbus)",
    hasProperty: "No",
    budget: "$300k - $500k",
    tags: [],
    notes: [],
    createdAt: "2026-01-11T00:00:00",
    fromSheets: false,
  },
  {
    id: "0pc7q6p3",
    name: "Shannon Fetterolf",
    company: "",
    email: "slmfett03@embarqmail.com",
    phone: "(330) 980-4143",
    projectType: "Build a Barndominium",
    stage: "New Inquiry",
    value: 0,
    source: "In the next 12 months",
    assignedTo: "u4",
    salesRep: "u2",
    region: "Northeast Ohio (Wooster / Akron)",
    hasProperty: "No",
    budget: "Under $300k",
    tags: [],
    notes: [],
    createdAt: "2026-01-15T00:00:00",
    fromSheets: false,
  },
  {
    id: "5avuydkh",
    name: "Sonya Atkins",
    company: "",
    email: "sonya.atkins73@yahoo.com",
    phone: "(281) 508-3643",
    projectType: "Build a Barndominium",
    stage: "Initial Consult Complete",
    value: 0,
    source: "12+ months out",
    assignedTo: "u4",
    salesRep: "u2",
    region: "Central Ohio (Columbus)",
    hasProperty: "No",
    budget: "Under $300k",
    tags: [],
    notes: [],
    createdAt: "2026-01-20T00:00:00",
    fromSheets: false,
  },
  {
    id: "cytc600l",
    name: "Gina Resar",
    company: "",
    email: "ginaresar@gmail.com",
    phone: "(440) 371-5240",
    projectType: "Build a Barndominium",
    stage: "New Inquiry",
    value: 0,
    source: "In the next 12 months",
    assignedTo: "u4",
    salesRep: "u2",
    region: "Northeast Ohio (Wooster / Akron)",
    hasProperty: "No",
    budget: "Under $300k",
    tags: [],
    notes: [],
    createdAt: "2026-01-24T00:00:00",
    fromSheets: false,
  },
  {
    id: "5jbvm9ni",
    name: "Valerie DeFreitas",
    company: "",
    email: "boxergirl1413@yahoo.com",
    phone: "(740) 591-7943",
    projectType: "Build a Barndominium",
    stage: "New Inquiry",
    value: 0,
    source: "12+ months out",
    assignedTo: "u4",
    salesRep: "u2",
    region: "Southeast Ohio",
    hasProperty: "No",
    budget: "Under $300k",
    tags: [],
    notes: [],
    createdAt: "2026-01-25T00:00:00",
    fromSheets: false,
  },
  {
    id: "w4rlgle1",
    name: "Jennifer Smith",
    company: "",
    email: "jennifermccament@yahoo.com",
    phone: "(740) 507-0090",
    projectType: "Build a Barndominium",
    stage: "Initial Consult Complete",
    value: 0,
    source: "In the next 12 months",
    assignedTo: "u4",
    salesRep: "u2",
    region: "Central Ohio (Columbus)",
    hasProperty: "Yes",
    budget: "Under $300k",
    tags: [],
    notes: [],
    createdAt: "2026-01-26T00:00:00",
    fromSheets: false,
  },
  {
    id: "p7ok72v7",
    name: "Kathleen Overy",
    company: "",
    email: "tylerandjaysmom@yahoo.com",
    phone: "(440) 371-9173",
    projectType: "Purchase a Barndominium",
    stage: "Initial Consult Complete",
    value: 0,
    source: "",
    assignedTo: "u4",
    salesRep: "u2",
    region: "",
    hasProperty: "Not sure",
    budget: "",
    tags: [],
    notes: [],
    createdAt: "2026-01-31T00:00:00",
    fromSheets: false,
  },,
  {
    id: "8aijotjk",
    name: "Angela Price",
    company: "",
    email: "angela0774@gmail.com",
    phone: "(330) 509-9888",
    projectType: "Build a Barndominium",
    stage: "New Inquiry",
    value: 0,
    source: "In the next 12 months",
    assignedTo: "u5",
    salesRep: "u2",
    region: "Northeast Ohio (Wooster / Akron)",
    hasProperty: "Not sure",
    budget: "$500k - $1M",
    tags: [],
    notes: [],
    createdAt: "2026-02-26T21:07:29.677281",
    fromSheets: false,
  },,
  {
    id: "jj28u8x4",
    name: "Angela Price",
    company: "",
    email: "angela0774@gmail.com",
    phone: "(330) 509-9888",
    projectType: "Build a Barndominium",
    stage: "New Inquiry",
    value: 0,
    source: "In the next 12 months",
    assignedTo: "u5",
    salesRep: "u2",
    region: "Northeast Ohio (Wooster / Akron)",
    hasProperty: "Not sure",
    budget: "$500k - $1M",
    tags: [],
    notes: [],
    createdAt: "2026-02-26T21:07:58.976902",
    fromSheets: false,
  },,
  {
    id: "x7impdk1",
    name: "Ramona Caporossi",
    company: "",
    email: "mydeer1@gmail.com",
    phone: "(330) 242-5941",
    projectType: "Build a Barndominium",
    stage: "New Inquiry",
    value: 0,
    source: "In the next 12 months",
    assignedTo: "u4",
    salesRep: "u3",
    region: "Central Ohio (Columbus)",
    hasProperty: "No",
    budget: "Under $300k",
    tags: [],
    notes: [],
    createdAt: "2025-07-06T00:00:00",
    fromSheets: False,
  },
  {
    id: "y29jqxs0",
    name: "Jennifer Londo",
    company: "",
    email: "jenniferlondo@hopeworks.co",
    phone: "(440) 714-1538",
    projectType: "Build a Barndominium",
    stage: "New Inquiry",
    value: 0,
    source: "ASAP",
    assignedTo: "u4",
    salesRep: "u3",
    region: "Northeast Ohio (Wooster / Akron)",
    hasProperty: "No",
    budget: "Under $300k",
    tags: [],
    notes: [],
    createdAt: "2025-12-18T00:00:00",
    fromSheets: False,
  },
  {
    id: "a9c3dwsb",
    name: "Pamela J Lockett",
    company: "",
    email: "lockettforever@gmail.com",
    phone: "(330) 990-7060",
    projectType: "Build a Barndominium",
    stage: "New Inquiry",
    value: 0,
    source: "In the next 12 months",
    assignedTo: "u4",
    salesRep: "u3",
    region: "Northeast Ohio (Wooster / Akron)",
    hasProperty: "No",
    budget: "$500k - $1M",
    tags: [],
    notes: [],
    createdAt: "2025-12-18T00:00:00",
    fromSheets: False,
  },
  {
    id: "wmnkjz3c",
    name: "James D Stachowiak",
    company: "",
    email: "jimkana@zoominternet.net",
    phone: "(330) 242-3201",
    projectType: "Build a Barndominium",
    stage: "Initial Consult Complete",
    value: 0,
    source: "ASAP",
    assignedTo: "u4",
    salesRep: "u3",
    region: "Northeast Ohio (Wooster / Akron)",
    hasProperty: "Yes",
    budget: "$300k - $500k",
    tags: [],
    notes: [],
    createdAt: "2025-12-19T00:00:00",
    fromSheets: False,
  },
  {
    id: "3g6dyb9o",
    name: "Rachel Metz",
    company: "",
    email: "rme.46732@gmail.com",
    phone: "(440) 591-2792",
    projectType: "Build a Barndominium",
    stage: "Initial Consult Complete",
    value: 0,
    source: "In the next 12 months",
    assignedTo: "u4",
    salesRep: "u3",
    region: "Northeast Ohio (Wooster / Akron)",
    hasProperty: "No",
    budget: "$300k - $500k",
    tags: [],
    notes: [],
    createdAt: "2025-12-29T00:00:00",
    fromSheets: False,
  },
  {
    id: "ru2t7gkk",
    name: "JJ Kocevar",
    company: "",
    email: "jkocevar13@gmail.com",
    phone: "(330) 419-3823",
    projectType: "Build a Barndominium",
    stage: "New Inquiry",
    value: 0,
    source: "ASAP",
    assignedTo: "u4",
    salesRep: "u3",
    region: "Northeast Ohio (Wooster / Akron)",
    hasProperty: "Yes",
    budget: "$300k - $500k",
    tags: [],
    notes: [],
    createdAt: "2026-01-14T00:00:00",
    fromSheets: False,
  },
  {
    id: "iihlz41u",
    name: "Kevin Schiele",
    company: "",
    email: "kevinschiele0625@yahoo.com",
    phone: "(330) 604-1597",
    projectType: "Build a Barndominium",
    stage: "New Inquiry",
    value: 0,
    source: "In the next 12 months",
    assignedTo: "u4",
    salesRep: "u3",
    region: "Northeast Ohio (Wooster / Akron)",
    hasProperty: "No",
    budget: "$500k - $1M",
    tags: [],
    notes: [],
    createdAt: "2026-02-21T00:00:00",
    fromSheets: False,
  },
];

function genId() { return Math.random().toString(36).slice(2, 10); }
function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}
function fmtMoney(n) {
  const v = Number(n || 0);
  if (v >= 1000000) return "$" + (v / 1000000).toFixed(2).replace(/\.?0+$/, "") + "M";
  if (v >= 1000)    return "$" + Math.round(v / 1000) + "k";
  return "$" + v.toLocaleString();
}

const PALETTE = ["#60a5fa","#f59e0b","#34d399","#f472b6","#a78bfa","#fb923c","#22d3ee","#f87171"];

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [authToken, setAuthToken] = useState(() => localStorage.getItem("bcrm:token") || null);
  const [authUser,  setAuthUser]  = useState(() => { try { return JSON.parse(localStorage.getItem("bcrm:user")); } catch { return null; } });
  const [leads,     setLeads]     = useState([]);
  const [team,      setTeam]      = useState(DEFAULT_TEAM);
  const [view,      setView]      = useState("leads");
  const [sel,       setSel]       = useState(null);
  const [me,        setMe]        = useState("u1");
  const [showLF,    setShowLF]    = useState(false);
  const [editL,     setEditL]     = useState(null);
  const [showTF,    setShowTF]    = useState(false);
  const [editM,     setEditM]     = useState(null);
  const [search,    setSearch]    = useState("");
  const [fStage,    setFStage]    = useState("");
  const [fWho,      setFWho]      = useState("");
  const [fTag,      setFTag]      = useState("");
  const [toast,     setToast]     = useState(null);
  const [ready,     setReady]     = useState(false);
  const [dbError,   setDbError]   = useState(false);
  const [gasUrl,    setGasUrl]    = useState("");
  const [syncing,   setSyncing]   = useState(false);
  const [lastSync,  setLastSync]  = useState(null);
  const [syncError, setSyncError] = useState(false);

  const handleAuth = (token, user) => {
    setAuthToken(token);
    setAuthUser(user);
    // Lock user to their team member profile by email
    const email = user?.email?.toLowerCase().trim() || "";
    const memberId = EMAIL_TO_MEMBER[email];
    if (memberId) {
      setMe(memberId);
      localStorage.setItem("bcrm:me", memberId);
    }
  };

  const handleSignOut = async () => {
    try { await sb.signOut(authToken); } catch {}
    localStorage.removeItem("bcrm:token");
    localStorage.removeItem("bcrm:user");
    setAuthToken(null);
    setAuthUser(null);
    setLeads([]);
    setReady(false);
  };

  // Don't load data until authenticated
  if (!authToken) return <LoginScreen onAuth={handleAuth} />;

  // ── Load from Supabase ────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [teamData, leadsData, notesData] = await Promise.all([
          sb.get("team_members", "?order=id"),
          sb.get("leads", "?order=created_at.desc"),
          sb.get("notes", "?order=created_at.desc"),
        ]);
        const notesByLead = {};
        notesData.forEach(n => {
          if (!notesByLead[n.lead_id]) notesByLead[n.lead_id] = [];
          notesByLead[n.lead_id].push({ id: n.id, text: n.text, memberId: n.member_id, createdAt: n.created_at });
        });
        const normalized = leadsData.map(l => ({
          id: l.id, name: l.name, company: l.company||"", email: l.email||"",
          phone: l.phone||"", projectType: l.project_type, stage: l.stage,
          value: Number(l.value||0), source: l.source||"",
          assignedTo: l.assigned_to||"", salesRep: l.sales_rep||"",
          region: l.region||"", hasProperty: l.has_property||"",
          budget: l.budget||"", tags: l.tags||[], fromSheets: l.from_sheets||false,
          createdAt: l.created_at, notes: notesByLead[l.id] || [],
        }));
        if (teamData.length) setTeam(teamData);
        setLeads(normalized);
        const savedMe  = localStorage.getItem("bcrm:me");
        const savedGas = localStorage.getItem("bcrm:gasUrl");
        if (savedMe)  setMe(savedMe);
        if (savedGas) setGasUrl(savedGas);
      } catch (e) {
        console.error("Supabase load error:", e);
        setDbError(true);
        setLeads(SAMPLE_LEADS);
      }
      setReady(true);
    })();
  }, []);

  // ── Realtime subscriptions ─────────────────────────────────────────────────
  useEffect(() => {
    if (!ready || dbError) return;
    const unsubLeads = sb.subscribe("leads", (event, record, oldRecord) => {
      if (event === "INSERT") {
        const l = record;
        setLeads(prev => {
          if (prev.find(x => x.id === l.id)) return prev;
          return [{ id: l.id, name: l.name, company: l.company||"", email: l.email||"", phone: l.phone||"", projectType: l.project_type, stage: l.stage, value: Number(l.value||0), source: l.source||"", assignedTo: l.assigned_to||"", salesRep: l.sales_rep||"", region: l.region||"", hasProperty: l.has_property||"", budget: l.budget||"", tags: l.tags||[], fromSheets: l.from_sheets||false, createdAt: l.created_at, notes: [] }, ...prev];
        });
      }
      if (event === "UPDATE") {
        const l = record;
        setLeads(prev => prev.map(x => x.id === l.id ? { ...x, name: l.name, email: l.email||"", phone: l.phone||"", projectType: l.project_type, stage: l.stage, value: Number(l.value||0), source: l.source||"", assignedTo: l.assigned_to||"", salesRep: l.sales_rep||"", region: l.region||"", hasProperty: l.has_property||"", budget: l.budget||"", tags: l.tags||[] } : x));
      }
      if (event === "DELETE") {
        setLeads(prev => prev.filter(x => x.id !== (oldRecord?.id)));
      }
    });
    const unsubNotes = sb.subscribe("notes", (event, record) => {
      if (event === "INSERT") {
        const note = { id: record.id, text: record.text, memberId: record.member_id, createdAt: record.created_at };
        setLeads(prev => prev.map(l => l.id === record.lead_id ? { ...l, notes: [note, ...l.notes] } : l));
        setSel(prev => prev?.id === record.lead_id ? { ...prev, notes: [note, ...prev.notes] } : prev);
      }
    });
    return () => { unsubLeads(); unsubNotes(); };
  }, [ready, dbError]);

  const saveGasUrl = url => { setGasUrl(url); localStorage.setItem("bcrm:gasUrl", url); };

  // ── Sheets sync → Supabase ────────────────────────────────────────────────
  const syncFromSheets = useCallback(async (url) => {
    const target = url || gasUrl;
    if (!target.trim()) return;
    setSyncing(true); setSyncError(false);
    try {
      const res = await fetch(target + "?action=get", { method: "GET" });
      const rows = await res.json();
      if (!Array.isArray(rows)) throw new Error("bad response");
      const existingEmails = new Set(leads.map(l => l.email?.toLowerCase()).filter(Boolean));
      const newRows = rows.filter(r => r.email && !existingEmails.has(r.email.toLowerCase()));
      for (const r of newRows) {
        await sb.post("leads", {
          name: r.name || r["Full Name"] || "", email: r.email || "",
          phone: r.phone || "", project_type: r["Are you looking to build or purchase a barndominium?"] || "Build a Barndominium",
          stage: "New Inquiry", source: r["How soon are you looking to get started?"] || "",
          region: r["What region of Ohio are you looking to build?"] || "",
          has_property: r["Do you have property for a building site?"] || "",
          budget: r["What is your estimated budget?"] || "", from_sheets: true,
        });
      }
      setLastSync(new Date());
      if (newRows.length) pop(`${newRows.length} new lead${newRows.length > 1 ? "s" : ""} from Sheets`);
    } catch { setSyncError(true); }
    setSyncing(false);
  }, [gasUrl, leads]);

  useEffect(() => {
    if (!gasUrl.trim() || !ready) return;
    syncFromSheets(gasUrl);
    const interval = setInterval(() => syncFromSheets(gasUrl), 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, [gasUrl, ready]);

  const switchMe = id => { setMe(id); localStorage.setItem("bcrm:me", id); };
  const pop = msg => { setToast(msg); setTimeout(() => setToast(null), 2800); };

  // ── CRUD → Supabase ───────────────────────────────────────────────────────
  const saveLead = async f => {
    try {
      if (f.id) {
        await sb.patch("leads", f.id, { name: f.name, company: f.company||"", email: f.email, phone: f.phone||"", project_type: f.projectType, stage: f.stage, value: f.value||0, source: f.source||"", assigned_to: f.assignedTo||null, sales_rep: f.salesRep||null, region: f.region||"", has_property: f.hasProperty||"", budget: f.budget||"", tags: f.tags||[] });
        setLeads(p => p.map(l => l.id === f.id ? { ...l, ...f } : l));
        setSel(p => p?.id === f.id ? { ...p, ...f } : p);
        pop("Lead updated ✓");
      } else {
        const [created] = await sb.post("leads", { name: f.name, company: f.company||"", email: f.email||"", phone: f.phone||"", project_type: f.projectType||"Build a Barndominium", stage: f.stage||"New Inquiry", value: f.value||0, source: f.source||"", assigned_to: f.assignedTo||null, sales_rep: f.salesRep||null, region: f.region||"", has_property: f.hasProperty||"Not sure", budget: f.budget||"", tags: f.tags||[] });
        setLeads(p => [{ ...f, id: created.id, notes: [], createdAt: created.created_at, assignedTo: f.assignedTo||"", salesRep: f.salesRep||"" }, ...p]);
        pop("Lead added ✓");
      }
    } catch (e) { pop("Error saving lead"); console.error(e); }
    setShowLF(false); setEditL(null);
  };

  const delLead = async id => {
    try {
      await sb.delete("leads", id);
      setLeads(p => p.filter(l => l.id !== id));
      setSel(null); setView("leads"); pop("Lead removed");
    } catch { pop("Error deleting lead"); }
  };

  const setStage = async (id, stage) => {
    try {
      await sb.patch("leads", id, { stage });
      setLeads(p => p.map(l => l.id === id ? { ...l, stage } : l));
      setSel(p => p?.id === id ? { ...p, stage } : p);
    } catch { pop("Error updating stage"); }
  };

  const addNote = async (lid, text) => {
    if (!text.trim()) return;
    try {
      const [note] = await sb.post("notes", { lead_id: lid, text: text.trim(), member_id: me });
      const n = { id: note.id, text: note.text, memberId: note.member_id, createdAt: note.created_at };
      setLeads(p => p.map(l => l.id === lid ? { ...l, notes: [n, ...l.notes] } : l));
      setSel(p => p?.id === lid ? { ...p, notes: [n, ...p.notes] } : p);
    } catch { pop("Error adding note"); }
  };

  const saveMember = async f => {
    try {
      if (f.id) {
        await sb.patch("team_members", f.id, { name: f.name, role: f.role, initials: f.initials, color: f.color });
        setTeam(p => p.map(m => m.id === f.id ? { ...m, ...f } : m));
        pop("Profile updated ✓");
      } else {
        const newId = genId();
        await sb.post("team_members", { id: newId, name: f.name, role: f.role, initials: f.initials, color: f.color });
        setTeam(p => [...p, { ...f, id: newId }]);
        pop("Member added ✓");
      }
    } catch { pop("Error saving member"); }
    setShowTF(false); setEditM(null);
  };

  const delMember = async id => {
    try {
      await sb.delete("team_members", id);
      setTeam(p => p.filter(m => m.id !== id));
      if (me === id) switchMe(team.find(m => m.id !== id)?.id || "u1");
      pop("Member removed");
    } catch { pop("Error removing member"); }
  };


  const myProfile = team.find(m => m.id === me) || team[0];

  const filtered = leads.filter(l => {
    const q = search.toLowerCase();
    return (
      (!q     || l.name.toLowerCase().includes(q) || (l.company||"").toLowerCase().includes(q) || (l.region||"").toLowerCase().includes(q) || l.email.toLowerCase().includes(q)) &&
      (!fStage || l.stage === fStage) &&
      (!fWho   || (fWho === "_none" ? !l.assignedTo : l.assignedTo === fWho)) &&
      (!fTag   || (l.tags||[]).includes(fTag))
    );
  });

  const activePipeline = leads.filter(l => !["Completed","Lost / No Sale"].includes(l.stage));
  const totalPipeline  = activePipeline.reduce((s, l) => s + (l.value || 0), 0);

  if (!ready) return <div style={S.splash}><div style={{textAlign:"center"}}><div style={{fontSize:40,marginBottom:8}}>🏠</div><div style={{fontSize:12,color:"#94a3b8"}}>Connecting to database…</div></div></div>;
  if (dbError) return (
    <div style={S.splash}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>Database unavailable</div>
        <div style={{ fontSize: 13, color: "#64748b" }}>Showing local data. Check your Supabase connection.</div>
      </div>
    </div>
  );

  return (
    <div style={S.root}>
      <style>{css}</style>
      {toast && <div style={S.toast}>{toast}</div>}

      {/* SIDEBAR */}
      <aside style={S.sidebar}>
        <div style={S.brand}>
          <span style={S.brandMark}>⬟</span>
          <div>
            <div style={S.brandName}>BuildCRM</div>
            <div style={S.brandSub}>Residential & Land</div>
          </div>
        </div>

        {/* Current user */}
        <div style={S.meBox}>
          <Avatar member={myProfile} size={36} />
          <div style={S.meText}>
            <div style={S.meName}>{myProfile?.name}</div>
            <div style={{ ...S.meRole, color: myProfile?.color }}>{myProfile?.role}</div>
          </div>
        </div>

        {/* No manual switching — identity is locked to login */}

        <nav style={S.nav}>
          <div style={S.navSection}>LEADS</div>
          {[
            ["leads",      "All Leads",   "◩"],
            ["toby-leads", "Toby Spade",  "▸"],
            ["mark-leads", "Mark Zollinger", "▸"],
          ].map(([v, label, icon]) => (
            <button key={v}
              style={{ ...S.navBtn, ...(view === v || (view === "detail" && v === "leads") ? S.navOn : {}), ...(v !== "leads" ? { paddingLeft: 22, fontSize: 12 } : {}) }}
              onClick={() => { setView(v); setSel(null); }}>
              <span style={S.navIco}>{icon}</span>{label}
            </button>
          ))}
          <div style={S.navSection}>LISTS</div>
          {[
            ["list-consult",   "Need Dev Consult", "📋"],
            ["list-financing", "Need Financing",   "💰"],
            ["list-reengage",  "Re-engage",        "🔄"],
            ["list-hasland",   "Has Land",         "😍"],
          ].map(([v, label, icon]) => (
            <button key={v}
              style={{ ...S.navBtn, ...(view === v ? S.navOn : {}), fontSize: 12 }}
              onClick={() => { setView(v); setSel(null); }}>
              <span style={S.navIco}>{icon}</span>{label}
            </button>
          ))}
          <div style={S.navSection}>OTHER</div>
          {[
            ["pipeline", "Pipeline", "▦"],
            ["team",     "Team",     "◈"],
            ["settings", "Settings", "⚙"],
          ].map(([v, label, icon]) => (
            <button key={v}
              style={{ ...S.navBtn, ...(view === v ? S.navOn : {}) }}
              onClick={() => { setView(v); setSel(null); }}>
              <span style={S.navIco}>{icon}</span>{label}
            </button>
          ))}
        </nav>

        <div style={S.statPanel}>
          <SidebarStat label="Active Leads"   value={activePipeline.length} />
          <SidebarStat label="Active Pipeline" value={fmtMoney(totalPipeline)} accent="#60a5fa" />
          <SidebarStat label="Contracts"       value={leads.filter(l => l.stage === "Contract Signed").length} accent="#34d399" />
          <SidebarStat label="Unassigned"      value={leads.filter(l => !l.assignedTo).length} accent="#f87171" />
        </div>

        {gasUrl.trim() && (
          <div style={S.syncBar}>
            <span style={{ ...S.syncDot, background: syncError ? "#f87171" : syncing ? "#fbbf24" : "#4ade80" }} />
            <div style={{ flex: 1 }}>
              <div style={S.syncLabel}>{syncing ? "Syncing…" : syncError ? "Sync failed" : "Sheets connected"}</div>
              {lastSync && !syncing && <div style={S.syncTime}>Last sync {lastSync.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>}
            </div>
            <button style={S.syncBtn} onClick={() => syncFromSheets(gasUrl)} disabled={syncing}>↺</button>
          </div>
        )}

        {/* Signed-in user + sign out */}
        <div style={{ margin: "0 10px 14px", padding: "10px 12px", background: "#1e293b", borderRadius: 8 }}>
          <div style={{ fontSize: 10, color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>🔒 Signed in as</div>
          <div style={{ fontSize: 12, color: "#e2e8f0", fontWeight: 700, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {myProfile?.name || authUser?.display_name || "—"}
          </div>
          <div style={{ fontSize: 10, color: "#475569", marginBottom: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{authUser?.email || ""}</div>
          <button onClick={handleSignOut} style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", color: "#94a3b8", borderRadius: 6, padding: "6px 0", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main style={S.main}>
        {view === "leads" && (
          <LeadsView
            title="All Leads" leads={filtered} team={team}
            search={search} setSearch={setSearch}
            fStage={fStage} setFStage={setFStage}
            fWho={fWho} setFWho={setFWho}
            fTag={fTag} setFTag={setFTag}
            onAdd={() => { setEditL(null); setShowLF(true); }}
            onSelect={l => { setSel(l); setView("detail"); }} />
        )}
        {view === "toby-leads" && (
          <LeadsView
            title="Toby Spade — Leads" subtitle="Developer: Columbus"
            leads={leads.filter(l => l.assignedTo === "u4")} team={team}
            search={search} setSearch={setSearch}
            fStage={fStage} setFStage={setFStage}
            fWho={fWho} setFWho={setFWho}
            fTag={fTag} setFTag={setFTag}
            onAdd={() => { setEditL(null); setShowLF(true); }}
            onSelect={l => { setSel(l); setView("detail"); }} />
        )}
        {view === "mark-leads" && (
          <LeadsView
            title="Mark Zollinger — Leads" subtitle="Developer: Wooster"
            leads={leads.filter(l => l.assignedTo === "u5")} team={team}
            search={search} setSearch={setSearch}
            fStage={fStage} setFStage={setFStage}
            fWho={fWho} setFWho={setFWho}
            fTag={fTag} setFTag={setFTag}
            onAdd={() => { setEditL(null); setShowLF(true); }}
            onSelect={l => { setSel(l); setView("detail"); }} />
        )}
        {view === "list-consult" && (
          <SmartList
            title="Need Developer Consult"
            subtitle="Leads past Initial Consult Complete with no developer assigned or meeting scheduled"
            icon="📋"
            leads={leads.filter(l =>
              ["Initial Consult Complete","Meeting Scheduled","Meeting Complete"].includes(l.stage) && !l.assignedTo
              || l.stage === "Initial Consult Complete"
            )}
            team={team}
            onSelect={l => { setSel(l); setView("detail"); }} />
        )}
        {view === "list-financing" && (
          <SmartList
            title="Need Financing"
            subtitle="Leads who do not yet have financing in place"
            icon="💰"
            leads={leads.filter(l =>
              !["Completed","Lost / No Sale","Contract Signed"].includes(l.stage) &&
              (l.tags||[]).includes("Needs Financing") ||
              (!["Completed","Lost / No Sale"].includes(l.stage) && l.budget && l.budget.toLowerCase().includes("under"))
            )}
            team={team}
            onSelect={l => { setSel(l); setView("detail"); }} />
        )}
        {view === "list-hasland" && (
          <SmartList
            title="Has Land"
            subtitle="Leads who already have property for a building site"
            icon="😍"
            leads={leads.filter(l =>
              l.hasProperty && l.hasProperty.toLowerCase().startsWith("yes") &&
              !["Completed","Lost / No Sale"].includes(l.stage)
            )}
            team={team}
            onSelect={l => { setSel(l); setView("detail"); }} />
        )}
        {view === "list-reengage" && (
          <SmartList
            title="Re-engage"
            subtitle="Leads that have gone quiet and need outreach"
            icon="🔄"
            leads={leads.filter(l =>
              !["Completed","Lost / No Sale","Contract Signed","In Progress"].includes(l.stage) &&
              ((l.tags||[]).includes("Follow Up") || (l.tags||[]).includes("Re-engage") ||
               l.stage === "New Inquiry")
            )}
            team={team}
            onSelect={l => { setSel(l); setView("detail"); }} />
        )}
        {view === "pipeline" && (
          <PipelineView leads={leads} team={team}
            onStageChange={setStage}
            onSelect={l => { setSel(l); setView("detail"); }} />
        )}
        {view === "team" && (
          <TeamView team={team} leads={leads} me={me}
            onAdd={() => { setEditM(null); setShowTF(true); }}
            onEdit={m => { setEditM(m); setShowTF(true); }}
            onDelete={delMember}
            onSwitch={switchMe} />
        )}
        {view === "detail" && sel && (
          <DetailView
            lead={sel} team={team} myProfile={myProfile}
            onBack={() => { setSel(null); setView("leads"); }}
            onEdit={() => { setEditL(sel); setShowLF(true); }}
            onDelete={() => delLead(sel.id)}
            onStageChange={s => setStage(sel.id, s)}
            onAddNote={text => addNote(sel.id, text)} />
        )}
        {view === "settings" && (
          <SettingsView
            gasUrl={gasUrl}
            onSaveUrl={saveGasUrl}
            onSync={() => syncFromSheets(gasUrl, leads)}
            syncing={syncing}
            lastSync={lastSync}
            syncError={syncError}
            leads={leads} />
        )}
      </main>

      {showLF && <LeadForm lead={editL} team={team} onSave={saveLead} onClose={() => { setShowLF(false); setEditL(null); }} />}
      {showTF && <TeamMemberForm member={editM} onSave={saveMember} onClose={() => { setShowTF(false); setEditM(null); }} />}
    </div>
  );
}

// ─── Leads View ───────────────────────────────────────────────────────────────

function LeadsView({ title, subtitle, leads, team, search, setSearch, fStage, setFStage, fWho, setFWho, fTag, setFTag, onAdd, onSelect }) {
  const [viewMode, setViewMode] = useState("cards");
  const [sortCol,  setSortCol]  = useState(null);
  const [sortDir,  setSortDir]  = useState("asc");
  const total = leads.reduce((s, l) => s + (l.value || 0), 0);

  const handleSort = col => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const STAGE_ORDER = Object.fromEntries(STAGES.map((s, i) => [s, i]));

  const sorted = sortCol ? [...leads].sort((a, b) => {
    let av, bv;
    if (sortCol === "name")        { av = a.name?.toLowerCase() || ""; bv = b.name?.toLowerCase() || ""; }
    else if (sortCol === "stage")  { av = STAGE_ORDER[a.stage] ?? 99; bv = STAGE_ORDER[b.stage] ?? 99; }
    else if (sortCol === "region") { av = a.region?.toLowerCase() || ""; bv = b.region?.toLowerCase() || ""; }
    else if (sortCol === "budget") { av = a.budget?.toLowerCase() || ""; bv = b.budget?.toLowerCase() || ""; }
    else if (sortCol === "source") { av = a.source?.toLowerCase() || ""; bv = b.source?.toLowerCase() || ""; }
    else if (sortCol === "hasProperty") { av = a.hasProperty?.toLowerCase() || ""; bv = b.hasProperty?.toLowerCase() || ""; }
    else if (sortCol === "salesRep")  { av = team.find(m => m.id === a.salesRep)?.name?.toLowerCase() || ""; bv = team.find(m => m.id === b.salesRep)?.name?.toLowerCase() || ""; }
    else if (sortCol === "assignedTo"){ av = team.find(m => m.id === a.assignedTo)?.name?.toLowerCase() || ""; bv = team.find(m => m.id === b.assignedTo)?.name?.toLowerCase() || ""; }
    else if (sortCol === "value")  { av = a.value || 0; bv = b.value || 0; }
    else if (sortCol === "createdAt") { av = a.createdAt || ""; bv = b.createdAt || ""; }
    else { av = ""; bv = ""; }
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  }) : leads;

  const SortTh = ({ col, flex, children, align }) => {
    const active = sortCol === col;
    return (
      <span
        onClick={() => handleSort(col)}
        style={{ flex, textAlign: align, cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 3, color: active ? "#0f172a" : "#94a3b8" }}
      >
        {children}
        <span style={{ fontSize: 9, opacity: active ? 1 : 0.4 }}>
          {active ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
        </span>
      </span>
    );
  };

  return (
    <div style={S.page}>
      <div style={S.pageHead}>
        <div>
          <h1 style={S.h1}>{title || "Leads"}</h1>
          <p style={S.sub}>{subtitle ? `${subtitle} · ` : ""}{leads.length} leads · {fmtMoney(total)} total value</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={S.viewToggle}>
            <button style={{ ...S.viewToggleBtn, ...(viewMode === "cards" ? S.viewToggleOn : {}) }} onClick={() => setViewMode("cards")} title="Card view">⊞</button>
            <button style={{ ...S.viewToggleBtn, ...(viewMode === "list" ? S.viewToggleOn : {}) }} onClick={() => setViewMode("list")} title="List view">≡</button>
          </div>
          <button style={S.addBtn} onClick={onAdd}>+ New Lead</button>
        </div>
      </div>

      <div style={S.filters}>
        <input style={S.searchBox} placeholder="Search name, region, email…" value={search} onChange={e => setSearch(e.target.value)} />
        <select style={S.sel} value={fStage} onChange={e => setFStage(e.target.value)}>
          <option value="">All Stages</option>
          {STAGES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select style={S.sel} value={fWho} onChange={e => setFWho(e.target.value)}>
          <option value="">All Team</option>
          {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          <option value="_none">Unassigned</option>
        </select>
        <select style={S.sel} value={fTag} onChange={e => setFTag(e.target.value)}>
          <option value="">All Tags</option>
          {TAGS.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>

      {leads.length === 0 && <div style={S.empty}>No leads match your filters.</div>}

      {viewMode === "cards" && (
        <div style={S.cardGrid}>
          {sorted.map(l => {
            const member = team.find(m => m.id === l.assignedTo);
            const sm = STAGE_META[l.stage] || STAGE_META["New Inquiry"];
            return (
              <div key={l.id} className="lcard" style={S.lCard} onClick={() => onSelect(l)}>
                <div style={{ ...S.stageStrip, background: sm.color }} />
                <div style={S.lCardInner}>
                  <div style={S.lTop}>
                    <span style={{ ...S.stagePill, color: sm.color, background: sm.bg }}>{l.stage}</span>
                    <span style={S.lValue}>{fmtMoney(l.value)}</span>
                  </div>
                  <div style={S.lName}>{l.name}</div>
                  {l.company && <div style={S.lCo}>{l.company}</div>}
                  <div style={S.lType}>{l.projectType}</div>
                  {l.region && <div style={S.lAddr}><span style={S.pin}>📍</span>{l.region}</div>}
                  <div style={S.lSpecs}>
                    {l.hasProperty && <Spec icon="🏡" label={`Property: ${l.hasProperty}`} />}
                    {l.budget      && <Spec icon="💰" label={l.budget} />}
                    {l.source      && <Spec icon="⏱" label={l.source} />}
                  </div>
                  <div style={S.lFoot}>
                    <div style={S.tagRow}>{(l.tags || []).slice(0, 2).map(t => <LeadTag key={t} t={t} />)}</div>
                    <div style={S.assignChip}>
                      {(() => { const sr = team.find(m => m.id === l.salesRep); return sr ? <><Avatar member={sr} size={20} /><span style={{ fontSize: 11, color: sr.color, fontWeight: 600, marginRight: 6 }}>{sr.name.split(" ")[0]}</span></> : null; })()}
                      {member
                        ? <><Avatar member={member} size={20} /><span style={{ fontSize: 11, color: member.color, fontWeight: 600 }}>{member.name.split(" ")[0]}</span></>
                        : <span style={S.unass}>Unassigned</span>
                      }
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === "list" && (
        <div style={S.listWrap}>
          <div style={S.listHeader}>
            <span style={{ flex: "0 0 28px" }} />
            <SortTh col="name"        flex="2 1 160px">Name</SortTh>
            <SortTh col="stage"       flex="1 1 120px">Stage</SortTh>
            <SortTh col="region"      flex="1 1 140px">Region</SortTh>
            <SortTh col="budget"      flex="1 1 100px">Budget</SortTh>
            <SortTh col="source"      flex="1 1 90px">Timeline</SortTh>
            <SortTh col="hasProperty" flex="1 1 80px">Property</SortTh>
            <SortTh col="salesRep"    flex="1 1 120px">Sales Rep</SortTh>
            <SortTh col="assignedTo"  flex="1 1 120px">Developer</SortTh>
            <SortTh col="value"       flex="0 0 70px" align="right">Value</SortTh>
          </div>
          {sorted.map(l => {
            const member = team.find(m => m.id === l.assignedTo);
            const salesRep = team.find(m => m.id === l.salesRep);
            const sm = STAGE_META[l.stage] || STAGE_META["New Inquiry"];
            return (
              <div key={l.id} style={S.listRow} className="lcard" onClick={() => onSelect(l)}>
                <div style={{ flex: "0 0 28px" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: sm.color, marginTop: 2 }} />
                </div>
                <div style={{ flex: "2 1 160px", minWidth: 0 }}>
                  <div style={S.listName}>{l.name}</div>
                  {l.email && <div style={S.listSub}>{l.email}</div>}
                </div>
                <div style={{ flex: "1 1 120px", minWidth: 0 }}>
                  <span style={{ ...S.stagePill, color: sm.color, background: sm.bg, display: "inline-block" }}>{l.stage}</span>
                </div>
                <div style={{ flex: "1 1 140px", fontSize: 12, color: "#64748b", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.region || "—"}</div>
                <div style={{ flex: "1 1 100px", fontSize: 12, color: "#64748b" }}>{l.budget || "—"}</div>
                <div style={{ flex: "1 1 90px", fontSize: 12, color: "#64748b", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.source || "—"}</div>
                <div style={{ flex: "1 1 80px", fontSize: 12, color: "#64748b" }}>{l.hasProperty || "—"}</div>
                <div style={{ flex: "1 1 120px", display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                  {salesRep ? <><Avatar member={salesRep} size={18} /><span style={{ fontSize: 11, color: salesRep.color, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{salesRep.name.split(" ")[0]}</span></> : <span style={{ fontSize: 11, color: "#cbd5e1" }}>—</span>}
                </div>
                <div style={{ flex: "1 1 120px", display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                  {member ? <><Avatar member={member} size={18} /><span style={{ fontSize: 11, color: member.color, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{member.name.split(" ")[0]}</span></> : <span style={{ fontSize: 11, color: "#cbd5e1" }}>—</span>}
                </div>
                <div style={{ flex: "0 0 70px", fontSize: 13, fontWeight: 700, color: "#0f172a", textAlign: "right" }}>{fmtMoney(l.value)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

function PipelineView({ leads, team, onStageChange, onSelect }) {
  return (
    <div style={S.page}>
      <div style={S.pageHead}>
        <div><h1 style={S.h1}>Pipeline</h1><p style={S.sub}>Drag cards between stages</p></div>
      </div>
      <div style={S.kanban}>
        {STAGES.map(stage => {
          const cards = leads.filter(l => l.stage === stage);
          const val   = cards.reduce((s, l) => s + (l.value || 0), 0);
          const sm    = STAGE_META[stage];
          return (
            <div key={stage} style={S.kCol}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { const id = e.dataTransfer.getData("lid"); onStageChange(id, stage); }}>
              <div style={{ ...S.kColBar, background: sm.color }} />
              <div style={S.kColHead}>
                <span style={{ color: sm.color, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>{stage}</span>
                <span style={{ ...S.kBadge, background: sm.bg, color: sm.color }}>{cards.length}</span>
              </div>
              <div style={{ ...S.kTotal, color: sm.color }}>{fmtMoney(val)}</div>
              {cards.map(l => {
                const member = team.find(m => m.id === l.assignedTo);
                return (
                  <div key={l.id} draggable className="kcard"
                    onDragStart={e => e.dataTransfer.setData("lid", l.id)}
                    onClick={() => onSelect(l)} style={S.kCard}>
                    <div style={S.kName}>{l.name}</div>
                    <div style={S.kType}>{l.projectType}</div>
                    {l.region && <div style={S.kAddr}>📍 {l.region.split(" (")[0]}</div>}
                    <div style={S.kFoot}>
                      <span style={S.kMoney}>{fmtMoney(l.value)}</span>
                      {member && <Avatar member={member} size={20} />}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Detail ───────────────────────────────────────────────────────────────────

function DetailView({ lead, team, myProfile, onBack, onEdit, onDelete, onStageChange, onAddNote }) {
  const [note,  setNote]  = useState("");
  const [conf,  setConf]  = useState(false);
  const member = team.find(m => m.id === lead.assignedTo);
  const sm     = STAGE_META[lead.stage] || STAGE_META["New Inquiry"];

  return (
    <div style={S.page}>
      {/* Top nav */}
      <div style={S.dNav}>
        <button style={S.backBtn} onClick={onBack}>← Back to Leads</button>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={S.editBtn} onClick={onEdit}>Edit Lead</button>
          <button style={S.delBtn}  onClick={() => setConf(true)}>Delete</button>
        </div>
      </div>

      {conf && (
        <div style={S.confBar}>
          Delete this lead permanently?
          <button style={S.confYes} onClick={onDelete}>Yes, delete</button>
          <button style={S.confNo}  onClick={() => setConf(false)}>Cancel</button>
        </div>
      )}

      {/* Hero banner */}
      <div style={{ ...S.hero, borderLeft: `4px solid ${sm.color}` }}>
        <div style={{ flex: 1 }}>
          <div style={S.heroTop}>
            <span style={{ ...S.stagePill, color: sm.color, background: sm.bg, fontSize: 11 }}>{lead.stage}</span>
            <span style={S.heroType}>{lead.projectType}</span>
            {(lead.tags || []).map(t => <LeadTag key={t} t={t} />)}
          </div>
          <h2 style={S.heroName}>{lead.name}</h2>
          {lead.company && <div style={S.heroCo}>{lead.company}</div>}
          {lead.region && <div style={S.heroAddr}>📍 {lead.region}</div>}
          <div style={S.heroSpecs}>
            {lead.hasProperty && <Spec icon="🏡" label={`Has property: ${lead.hasProperty}`} />}
            {lead.budget      && <Spec icon="💰" label={`Budget: ${lead.budget}`} />}
            {lead.source      && <Spec icon="⏱" label={`Timeline: ${lead.source}`} />}
          </div>
        </div>
        <div style={S.heroVal}>
          <div style={S.heroValNum}>{fmtMoney(lead.value)}</div>
          <div style={S.heroValLbl}>Contract Value</div>
        </div>
      </div>

      <div style={S.dCols}>
        {/* Contact info */}
        <div style={S.infoCard}>
          <div style={S.cardLabel}>Contact Info</div>
          {[
            ["Email",        lead.email],
            ["Phone",        lead.phone || "—"],
            ["Build or Buy",  lead.projectType || "—"],
            ["Has Property", lead.hasProperty || "—"],
            ["Region",       lead.region || "—"],
            ["Timeline",     lead.source || "—"],
            ["Budget",       lead.budget || "—"],
            ["Added",        fmtDate(lead.createdAt)],
          ].map(([k, v]) => (
            <div key={k} style={S.iRow}>
              <span style={S.iKey}>{k}</span>
              <span style={S.iVal}>{v}</span>
            </div>
          ))}
        </div>

        {/* Deal controls */}
        <div style={S.infoCard}>
          <div style={S.cardLabel}>Deal Details</div>
          <div style={S.iRow}>
            <span style={S.iKey}>Stage</span>
            <select style={{ ...S.stageSel, color: sm.color }} value={lead.stage} onChange={e => onStageChange(e.target.value)}>
              {STAGES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div style={S.iRow}>
            <span style={S.iKey}>Assigned To</span>
            {member
              ? <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <Avatar member={member} size={22} />
                  <span style={{ color: member.color, fontWeight: 600, fontSize: 13 }}>{member.name}</span>
                  <span style={{ color: "#4a5568", fontSize: 11 }}>({member.role})</span>
                </div>
              : <span style={S.unass}>Unassigned</span>
            }
          </div>
          <div style={S.iRow}>
            <span style={S.iKey}>Contract Value</span>
            <span style={{ color: "#f59e0b", fontWeight: 800, fontSize: 20, letterSpacing: "-0.02em" }}>{fmtMoney(lead.value)}</span>
          </div>
        </div>
      </div>

      {/* Notes / Activity */}
      <div style={S.notesCard}>
        <div style={S.cardLabel}>Meeting Notes & Activity</div>
        <div style={S.noteCompose}>
          <Avatar member={myProfile} size={30} />
          <textarea style={S.noteTa}
            placeholder={`Log a note as ${myProfile?.name}… (Ctrl+Enter to post)`}
            value={note} onChange={e => setNote(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { onAddNote(note); setNote(""); } }} />
          <button style={S.noteBtn} onClick={() => { onAddNote(note); setNote(""); }}>Post</button>
        </div>
        {(lead.notes || []).length === 0 && <div style={S.empty}>No notes yet — log your first interaction above.</div>}
        {(lead.notes || []).map(n => {
          const author = team.find(m => m.id === n.memberId);
          return (
            <div key={n.id} style={S.noteItem}>
              <div style={S.noteHead}>
                <Avatar member={author} size={26} />
                <span style={{ color: author?.color || "#94a3b8", fontWeight: 700, fontSize: 13 }}>{author?.name || "Unknown"}</span>
                <span style={{ color: author?.color || "#94a3b8", fontSize: 10, opacity: 0.7 }}>{author?.role}</span>
                <span style={S.noteDate}>{fmtDate(n.createdAt)}</span>
              </div>
              <p style={S.noteBody}>{n.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Team View ────────────────────────────────────────────────────────────────

function TeamView({ team, leads, me, onAdd, onEdit, onDelete, onSwitch }) {
  return (
    <div style={S.page}>
      <div style={S.pageHead}>
        <div><h1 style={S.h1}>Team</h1><p style={S.sub}>Sales reps & the developer — who handles what</p></div>
        <button style={S.addBtn} onClick={onAdd}>+ Add Member</button>
      </div>
      <div style={S.teamGrid}>
        {team.map(m => {
          const mine     = leads.filter(l => l.assignedTo === m.id);
          const active   = mine.filter(l => !["Completed","Lost / No Sale"].includes(l.stage));
          const meetings = mine.filter(l => ["Meeting Scheduled","Meeting Complete"].includes(l.stage));
          const pipe     = active.reduce((s, l) => s + (l.value || 0), 0);
          const isDev    = m.role.toLowerCase().includes("developer");
          return (
            <div key={m.id} style={{ ...S.memberCard, borderTop: `3px solid ${m.color}` }}>
              <div style={S.memberTop}>
                <Avatar member={m} size={48} />
                <div style={{ flex: 1 }}>
                  <div style={S.mName}>{m.name}</div>
                  <div style={{ ...S.mRole, color: m.color }}>{m.role}</div>
                  {isDev && <div style={S.devNote}>Handles client meetings</div>}
                </div>
                {me === m.id && <span style={S.activeTag}>● You</span>}
              </div>

              <div style={S.memberStatsGrid}>
                <MStat n={mine.length}            label="Leads"    />
                <MStat n={active.length}          label="Active"   color="#f59e0b" />
                <MStat n={meetings.length}        label="Meetings" color="#60a5fa" />
                <MStat n={fmtMoney(pipe)}         label="Pipeline" color={m.color} />
              </div>

              {/* Recent leads */}
              {mine.slice(0, 2).map(l => (
                <div key={l.id} style={S.leadChip}>
                  <span style={{ ...S.chipDot, background: STAGE_META[l.stage]?.color || "#94a3b8" }} />
                  <span style={S.chipName}>{l.name}</span>
                  <span style={S.chipVal}>{fmtMoney(l.value)}</span>
                </div>
              ))}

              <div style={{ display: "flex", gap: 7, marginTop: 14 }}>
                <button style={S.smSwitch} onClick={() => onSwitch(m.id)}>Switch to</button>
                <button style={S.smEdit}   onClick={() => onEdit(m)}>Edit</button>
                {team.length > 1 && <button style={S.smDel} onClick={() => onDelete(m.id)}>Remove</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Lead Form ────────────────────────────────────────────────────────────────

function LeadForm({ lead, team, onSave, onClose }) {
  const [f, setF] = useState({
    id: lead?.id||"", name: lead?.name||"", company: lead?.company||"",
    email: lead?.email||"", phone: lead?.phone||"",
    projectType: lead?.projectType || PROJECT_TYPES[0],
    hasProperty: lead?.hasProperty || "Yes",
    region: lead?.region || OHIO_REGIONS[0],
    source: lead?.source || LEAD_SOURCES[0],
    budget: lead?.budget||"",
    stage: lead?.stage || STAGES[0],
    value: lead?.value||"",
    assignedTo: lead?.assignedTo||"",
    salesRep:   lead?.salesRep||"",
    tags: lead?.tags||[],
  });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const toggle = t => set("tags", f.tags.includes(t) ? f.tags.filter(x => x !== t) : [...f.tags, t]);

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        <div style={S.mHead}>
          <span style={S.mTitle}>{f.id ? "Edit Lead" : "New Lead"}</span>
          <button style={S.mClose} onClick={onClose}>✕</button>
        </div>

        <Section label="Contact">
          <FGrid>
            <Field label="Client Name *"><FInput value={f.name}    onChange={e => set("name",    e.target.value)} /></Field>
            <Field label="Company / Developer"><FInput value={f.company} onChange={e => set("company", e.target.value)} /></Field>
            <Field label="Email *"><FInput value={f.email}   onChange={e => set("email",   e.target.value)} /></Field>
            <Field label="Phone"><FInput value={f.phone}   onChange={e => set("phone",   e.target.value)} /></Field>
          </FGrid>
        </Section>

        <Section label="Project">
          <FGrid>
            <Field label="Build or Purchase?">
              <FSelect value={f.projectType} onChange={e => set("projectType", e.target.value)}>
                {PROJECT_TYPES.map(p => <option key={p}>{p}</option>)}
              </FSelect>
            </Field>
            <Field label="Do they have property?">
              <FSelect value={f.hasProperty} onChange={e => set("hasProperty", e.target.value)}>
                {["Yes","No","Not sure"].map(o => <option key={o}>{o}</option>)}
              </FSelect>
            </Field>
            <Field label="Region of Ohio">
              <FSelect value={f.region} onChange={e => set("region", e.target.value)}>
                {OHIO_REGIONS.map(r => <option key={r}>{r}</option>)}
              </FSelect>
            </Field>
            <Field label="How soon to get started?">
              <FSelect value={f.source} onChange={e => set("source", e.target.value)}>
                {LEAD_SOURCES.map(s => <option key={s}>{s}</option>)}
              </FSelect>
            </Field>
            <Field label="Estimated Budget"><FInput value={f.budget} onChange={e => set("budget", e.target.value)} placeholder="e.g. $400k–$500k" /></Field>
            <Field label="Contract Value ($)"><FInput type="number" value={f.value} onChange={e => set("value", Number(e.target.value))} /></Field>
            <Field label="Stage" wide>
              <FSelect value={f.stage} onChange={e => set("stage", e.target.value)}>
                {STAGES.map(s => <option key={s}>{s}</option>)}
              </FSelect>
            </Field>
          </FGrid>
        </Section>

        <Section label="Assignment">
          <FGrid>
            <Field label="Sales Rep">
              <FSelect value={f.salesRep} onChange={e => set("salesRep", e.target.value)}>
                <option value="">Unassigned</option>
                {team.filter(m => m.role === "Sales Rep").map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </FSelect>
            </Field>
            <Field label="Developer">
              <FSelect value={f.assignedTo} onChange={e => set("assignedTo", e.target.value)}>
                <option value="">Unassigned</option>
                {team.filter(m => m.role.toLowerCase().includes("developer")).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </FSelect>
            </Field>
          </FGrid>
        </Section>

        <Section label="Tags">
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {TAGS.map(t => (
              <span key={t} onClick={() => toggle(t)} style={{
                padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
                background: f.tags.includes(t) ? "#eff6ff" : "#f8fafc",
                color:      f.tags.includes(t) ? "#1d4ed8" : "#94a3b8",
                border:     f.tags.includes(t) ? "1px solid #bfdbfe" : "1px solid #e2e8f0",
              }}>{t}</span>
            ))}
          </div>
        </Section>

        <div style={S.mFoot}>
          <button style={S.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={S.saveBtn}   onClick={() => { if (!f.name || !f.email) return; onSave(f); }}>
            {f.id ? "Save Changes" : "Add Lead"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Team Member Form ─────────────────────────────────────────────────────────

function TeamMemberForm({ member, onSave, onClose }) {
  const [f, setF] = useState({
    id: member?.id||"", name: member?.name||"",
    role: member?.role||"Sales Rep", initials: member?.initials||"",
    color: member?.color || PALETTE[0],
  });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...S.modal, maxWidth: 420 }}>
        <div style={S.mHead}>
          <span style={S.mTitle}>{f.id ? "Edit Profile" : "Add Team Member"}</span>
          <button style={S.mClose} onClick={onClose}>✕</button>
        </div>
        <Field label="Full Name *"><FInput value={f.name} onChange={e => set("name", e.target.value)} /></Field>
        <div style={{ marginTop: 14 }}>
          <Field label="Role">
            <FSelect value={f.role} onChange={e => set("role", e.target.value)}>
              {["Developer","Sales Rep","Sales Manager","Project Coordinator","Estimator","Other"].map(r => <option key={r}>{r}</option>)}
            </FSelect>
          </Field>
        </div>
        <div style={{ marginTop: 14 }}>
          <Field label="Initials (2 chars)"><FInput value={f.initials} onChange={e => set("initials", e.target.value)} maxLength={2} /></Field>
        </div>
        <div style={{ marginTop: 14, marginBottom: 22 }}>
          <div style={S.fLabel}>Profile Color</div>
          <div style={{ display: "flex", gap: 9, marginTop: 8 }}>
            {PALETTE.map(c => (
              <div key={c} onClick={() => set("color", c)} style={{
                width: 24, height: 24, borderRadius: "50%", background: c, cursor: "pointer",
                border: f.color === c ? "2px solid #fff" : "2px solid transparent",
                outline: f.color === c ? `2px solid ${c}` : "none",
              }} />
            ))}
          </div>
        </div>
        <div style={S.mFoot}>
          <button style={S.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={S.saveBtn}   onClick={() => { if (!f.name) return; onSave(f); }}>
            {f.id ? "Save Changes" : "Add Member"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Reusable UI ──────────────────────────────────────────────────────────────

function Avatar({ member, size = 28 }) {
  if (!member) return <div style={{ width: size, height: size, borderRadius: Math.round(size * 0.28), background: "#222", flexShrink: 0 }} />;
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.28),
      background: member.color + "22", color: member.color,
      border: `1px solid ${member.color}55`,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: Math.round(size * 0.36), fontWeight: 800, flexShrink: 0,
    }}>{member.initials}</div>
  );
}

function LeadTag({ t }) {
  return <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>{t}</span>;
}

function Spec({ icon, label }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#6b7280" }}><span style={{ fontSize: 12 }}>{icon}</span>{label}</span>;
}

function SidebarStat({ label, value, accent }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
      <span style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.09em" }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: accent || "#94a3b8" }}>{value}</span>
    </div>
  );
}

function MStat({ n, label, color }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 17, fontWeight: 800, color: color || "#111827", letterSpacing: "-0.02em" }}>{n}</div>
      <div style={{ fontSize: 9, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em", color: "#94a3b8", marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid #e2e8f0" }}>{label}</div>
      {children}
    </div>
  );
}

function FGrid({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>{children}</div>;
}

function Field({ label, children, wide }) {
  return (
    <div style={{ marginBottom: 12, ...(wide ? { gridColumn: "1/-1" } : {}) }}>
      <label style={S.fLabel}>{label}</label>
      {children}
    </div>
  );
}

function FInput({ value, onChange, placeholder, type, maxLength }) {
  return <input style={S.fInput} value={value} onChange={onChange} placeholder={placeholder} type={type} maxLength={maxLength} />;
}

function FSelect({ value, onChange, children }) {
  return <select style={S.fInput} value={value} onChange={onChange}>{children}</select>;
}


// ─── Settings View ────────────────────────────────────────────────────────────

function SettingsView({ gasUrl, onSaveUrl, onSync, syncing, lastSync, syncError, leads }) {
  const [draft, setDraft] = useState(gasUrl);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onSaveUrl(draft.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const sheetsLeads = leads.filter(l => l.fromSheets);

  const GAS_SCRIPT = `// ─── BuildCRM → Google Sheets Integration ───────────────────────────────────
// 1. Open your Google Sheet
// 2. Click Extensions → Apps Script
// 3. Delete any existing code and paste this entire script
// 4. Click Save, then Deploy → New deployment
// 5. Set type to "Web app", execute as "Me", access "Anyone"
// 6. Click Deploy and copy the Web App URL into BuildCRM Settings

function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const rows  = sheet.getDataRange().getValues();
  const headers = rows[0].map(h => String(h).trim());
  const leads = rows.slice(1).filter(r => r.some(c => c !== "")).map(r => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = r[i] ?? ""; });
    return obj;
  });
  return ContentService
    .createTextOutput(JSON.stringify(leads))
    .setMimeType(ContentService.MimeType.JSON);
}`;

  return (
    <div style={S.page}>
      <div style={S.pageHead}>
        <div>
          <h1 style={S.h1}>Settings</h1>
          <p style={S.sub}>Connect BuildCRM to Google Sheets</p>
        </div>
      </div>

      {/* Connection card */}
      <div style={S.settingsCard}>
        <div style={S.settingsCardHead}>
          <span style={S.settingsIcon}>📊</span>
          <div>
            <div style={S.settingsCardTitle}>Google Sheets Sync</div>
            <div style={S.settingsCardSub}>New rows added to your Sheet appear in BuildCRM automatically every 3 minutes</div>
          </div>
          {gasUrl.trim() && (
            <div style={{ ...S.connBadge, background: syncError ? "#fef2f2" : "#f0fdf4", color: syncError ? "#dc2626" : "#16a34a", border: `1px solid ${syncError ? "#fecaca" : "#bbf7d0"}` }}>
              {syncError ? "⚠ Error" : "● Connected"}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={S.fLabel}>Google Apps Script Web App URL</label>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <input
              style={{ ...S.fInput, flex: 1, fontFamily: "monospace", fontSize: 12 }}
              placeholder="https://script.google.com/macros/s/..."
              value={draft}
              onChange={e => setDraft(e.target.value)}
            />
            <button style={S.saveBtn} onClick={handleSave}>
              {saved ? "Saved ✓" : "Save"}
            </button>
          </div>
        </div>

        {gasUrl.trim() && (
          <div style={S.syncStatusRow}>
            <span style={{ ...S.syncDot, background: syncError ? "#f87171" : syncing ? "#fbbf24" : "#4ade80" }} />
            <span style={{ fontSize: 13, color: "#64748b" }}>
              {syncing ? "Syncing now…" : syncError ? "Last sync failed — check your URL" : lastSync ? `Last synced at ${lastSync.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Not yet synced"}
            </span>
            <button style={S.manualSyncBtn} onClick={onSync} disabled={syncing}>
              {syncing ? "Syncing…" : "Sync now"}
            </button>
          </div>
        )}

        {sheetsLeads.length > 0 && (
          <div style={{ marginTop: 16, padding: "10px 14px", background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0", fontSize: 13, color: "#15803d", fontWeight: 600 }}>
            ✓ {sheetsLeads.length} lead{sheetsLeads.length !== 1 ? "s" : ""} imported from Sheets so far
          </div>
        )}
      </div>

      {/* Setup instructions */}
      <div style={S.settingsCard}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>Setup Instructions</div>
        {[
          ["1", "Open your Google Sheet", "Go to the Sheet where you enter new leads."],
          ["2", "Open Apps Script", 'Click Extensions in the menu bar, then Apps Script.'],
          ["3", "Paste the script", "Delete any existing code in the editor and paste the script below."],
          ["4", "Deploy as Web App", 'Click Deploy → New deployment. Set type to "Web app", execute as "Me", access "Anyone". Click Deploy.'],
          ["5", "Copy the URL", "Copy the Web App URL and paste it into the field above."],
          ["6", "Set up your Sheet columns", "Your Sheet headers should match the field names listed below — order doesn't matter."],
        ].map(([n, title, desc]) => (
          <div key={n} style={S.stepRow}>
            <div style={S.stepNum}>{n}</div>
            <div>
              <div style={S.stepTitle}>{title}</div>
              <div style={S.stepDesc}>{desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Sheet columns reference */}
      <div style={S.settingsCard}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>Sheet Column Names</div>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 14 }}>Use these exact names as column headers in row 1 of your Sheet. Only <code style={{ background: "#f1f5f9", padding: "1px 5px", borderRadius: 4 }}>name</code> and <code style={{ background: "#f1f5f9", padding: "1px 5px", borderRadius: 4 }}>email</code> are required.</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
          {[
            ["name","Full Name *"],
            ["email","Email *"],
            ["phone","Phone"],
            ["projectType","Build or purchase?"],
            ["hasProperty","Have property?"],
            ["region","Region of Ohio"],
            ["source","How soon to start?"],
            ["budget","Estimated budget"],
            ["stage","Pipeline stage"],
            ["value","Contract value ($)"],
            ["tags","Tags (comma-separated)"],
          ].map(([col, desc]) => (
            <div key={col} style={S.colChip}>
              <code style={S.colCode}>{col}</code>
              <span style={S.colDesc}>{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* GAS script */}
      <div style={S.settingsCard}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Apps Script Code</div>
          <button style={S.copyBtn} onClick={() => navigator.clipboard.writeText(GAS_SCRIPT)}>Copy script</button>
        </div>
        <pre style={S.codeBlock}>{GAS_SCRIPT}</pre>
      </div>
    </div>
  );
}


// ─── Smart List View ──────────────────────────────────────────────────────────

function SmartList({ title, subtitle, icon, leads, team, onSelect }) {
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  const handleSort = col => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const STAGE_ORDER = Object.fromEntries(STAGES.map((s, i) => [s, i]));

  const sorted = sortCol ? [...leads].sort((a, b) => {
    let av, bv;
    if (sortCol === "name")       { av = a.name?.toLowerCase() || ""; bv = b.name?.toLowerCase() || ""; }
    else if (sortCol === "stage") { av = STAGE_ORDER[a.stage] ?? 99; bv = STAGE_ORDER[b.stage] ?? 99; }
    else if (sortCol === "region"){ av = a.region?.toLowerCase() || ""; bv = b.region?.toLowerCase() || ""; }
    else if (sortCol === "budget"){ av = a.budget?.toLowerCase() || ""; bv = b.budget?.toLowerCase() || ""; }
    else if (sortCol === "salesRep")   { av = team.find(m => m.id === a.salesRep)?.name?.toLowerCase() || ""; bv = team.find(m => m.id === b.salesRep)?.name?.toLowerCase() || ""; }
    else if (sortCol === "assignedTo") { av = team.find(m => m.id === a.assignedTo)?.name?.toLowerCase() || ""; bv = team.find(m => m.id === b.assignedTo)?.name?.toLowerCase() || ""; }
    else { av = ""; bv = ""; }
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  }) : leads;

  const SortTh = ({ col, flex, children, align }) => {
    const active = sortCol === col;
    return (
      <span onClick={() => handleSort(col)} style={{ flex, textAlign: align, cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 3, color: active ? "#0f172a" : "#94a3b8" }}>
        {children}
        <span style={{ fontSize: 9, opacity: active ? 1 : 0.4 }}>{active ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}</span>
      </span>
    );
  };

  return (
    <div style={S.page}>
      <div style={S.pageHead}>
        <div>
          <h1 style={S.h1}>{icon} {title}</h1>
          <p style={S.sub}>{subtitle} · {leads.length} leads</p>
        </div>
      </div>

      {leads.length === 0 ? (
        <div style={{ ...S.empty, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, gridColumn: "unset" }}>
          🎉 No leads in this list right now.
        </div>
      ) : (
        <div style={S.listWrap}>
          <div style={S.listHeader}>
            <span style={{ flex: "0 0 28px" }} />
            <SortTh col="name"       flex="2 1 160px">Name</SortTh>
            <SortTh col="stage"      flex="1 1 130px">Stage</SortTh>
            <SortTh col="region"     flex="1 1 140px">Region</SortTh>
            <SortTh col="budget"     flex="1 1 110px">Budget</SortTh>
            <SortTh col="salesRep"   flex="1 1 120px">Sales Rep</SortTh>
            <SortTh col="assignedTo" flex="1 1 120px">Developer</SortTh>
          </div>
          {sorted.map(l => {
            const member = team.find(m => m.id === l.assignedTo);
            const salesRep = team.find(m => m.id === l.salesRep);
            const sm = STAGE_META[l.stage] || STAGE_META["New Inquiry"];
            return (
              <div key={l.id} style={S.listRow} className="lcard" onClick={() => onSelect(l)}>
                <div style={{ flex: "0 0 28px" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: sm.color, marginTop: 2 }} />
                </div>
                <div style={{ flex: "2 1 160px", minWidth: 0 }}>
                  <div style={S.listName}>{l.name}</div>
                  {l.phone && <div style={S.listSub}>{l.phone}</div>}
                </div>
                <div style={{ flex: "1 1 130px", minWidth: 0 }}>
                  <span style={{ ...S.stagePill, color: sm.color, background: sm.bg, display: "inline-block" }}>{l.stage}</span>
                </div>
                <div style={{ flex: "1 1 140px", fontSize: 12, color: "#64748b", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.region || "—"}</div>
                <div style={{ flex: "1 1 110px", fontSize: 12, color: "#64748b" }}>{l.budget || "—"}</div>
                <div style={{ flex: "1 1 120px", display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                  {salesRep ? <><Avatar member={salesRep} size={18} /><span style={{ fontSize: 11, color: salesRep.color, fontWeight: 600 }}>{salesRep.name.split(" ")[0]}</span></> : <span style={{ fontSize: 11, color: "#cbd5e1" }}>—</span>}
                </div>
                <div style={{ flex: "1 1 120px", display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                  {member ? <><Avatar member={member} size={18} /><span style={{ fontSize: 11, color: member.color, fontWeight: 600 }}>{member.name.split(" ")[0]}</span></> : <span style={{ fontSize: 11, color: "#cbd5e1" }}>Unassigned</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ─── Login Screen ─────────────────────────────────────────────────────────────

function LoginScreen({ onAuth }) {
  const [mode,        setMode]        = useState("login");
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error,       setError]       = useState("");
  const [loading,     setLoading]     = useState(false);

  const inputStyle = { width: "100%", padding: "10px 14px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", color: "#0f172a" };
  const labelStyle = { fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 };

  const submit = async () => {
    if (!email.trim() || !password.trim()) { setError("Please enter your email and password."); return; }
    if (mode === "signup" && !displayName.trim()) { setError("Please enter your name."); return; }
    setLoading(true); setError("");
    try {
      let data;
      if (mode === "login") {
        data = await sb.signIn(email.trim(), password);
      } else {
        // Sign up with display name stored in user_metadata
        const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
          method: "POST",
          headers: { "apikey": SUPABASE_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password, data: { display_name: displayName.trim() } }),
        });
        data = await r.json();
        if (!r.ok) throw new Error(data.msg || data.error_description || "Sign up failed");
        if (!data.access_token) {
          setError("Account created! Check your email to confirm, then sign in.");
          setMode("login"); setLoading(false); return;
        }
      }
      const user = data.user;
      // Attach display_name so the rest of the app can use it
      const displayNameFinal = user?.user_metadata?.display_name || displayName.trim() || user?.email?.split("@")[0] || "";
      const enrichedUser = { ...user, display_name: displayNameFinal };
      localStorage.setItem("bcrm:token", data.access_token);
      localStorage.setItem("bcrm:user",  JSON.stringify(enrichedUser));
      onAuth(data.access_token, enrichedUser);
    } catch (e) {
      setError(e.message || "Something went wrong.");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ width: 400, background: "#fff", borderRadius: 16, padding: "40px 36px", boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
          <span style={{ fontSize: 28, color: "#dc2626" }}>⬟</span>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.5px" }}>BuildCRM</div>
            <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>Spade Custom Homes</div>
          </div>
        </div>

        <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>
          {mode === "login" ? "Welcome back" : "Create account"}
        </div>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 28 }}>
          {mode === "login" ? "Sign in to access your leads" : "Set up your account to get started"}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {mode === "signup" && (
            <div>
              <label style={labelStyle}>Your Name</label>
              <input
                type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submit()}
                placeholder="e.g. Michelle French"
                style={inputStyle}
                autoFocus
              />
            </div>
          )}
          <div>
            <label style={labelStyle}>Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()}
              placeholder="you@example.com"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()}
              placeholder="••••••••"
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{ fontSize: 12, color: error.includes("Check your email") ? "#16a34a" : "#dc2626", background: error.includes("Check your email") ? "#dcfce7" : "#fef2f2", padding: "10px 14px", borderRadius: 8 }}>
              {error}
            </div>
          )}

          <button onClick={submit} disabled={loading}
            style={{ width: "100%", padding: "12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, fontFamily: "inherit", marginTop: 4 }}>
            {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </div>

        <div style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: "#64748b" }}>
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <span onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setDisplayName(""); }} style={{ color: "#dc2626", fontWeight: 700, cursor: "pointer" }}>
            {mode === "login" ? "Sign up" : "Sign in"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: #f1f5f9; }
  ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
  .lcard { transition: transform 0.14s, box-shadow 0.14s; cursor: pointer; }
  .lcard:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(15,23,42,0.10); background: #f8fafc; }
  .kcard { transition: all 0.12s; }
  .kcard:hover { transform: translateY(-2px); box-shadow: 0 4px 14px rgba(15,23,42,0.10); cursor: grab; }
  textarea { resize: none; }
  input:focus, select:focus, textarea:focus { outline: 2px solid #dc2626; outline-offset: 1px; }
  input::placeholder, textarea::placeholder { color: #94a3b8; }
  select option { background: #fff; color: #0f172a; }
  button:hover { opacity: 0.9; }
`;

const S = {
  root:   { display: "flex", height: "100vh", background: "#f8fafc", color: "#0f172a", fontFamily: "'Plus Jakarta Sans', sans-serif", overflow: "hidden" },
  splash: { display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f8fafc" },

  // Sidebar — clean dark slate
  sidebar:   { width: 240, background: "#0f172a", display: "flex", flexDirection: "column", flexShrink: 0, overflowY: "auto" },
  brand:     { display: "flex", alignItems: "center", gap: 10, padding: "20px 18px 16px", borderBottom: "1px solid #1e293b" },
  brandMark: { fontSize: 20, color: "#dc2626" },
  brandName: { fontSize: 15, fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.03em" },
  brandSub:  { fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 1 },

  meBox:    { display: "flex", alignItems: "center", gap: 10, padding: "14px 16px 6px" },
  meText:   {},
  meName:   { fontSize: 13, fontWeight: 700, color: "#f1f5f9" },
  meRole:   { fontSize: 10, fontWeight: 500, marginTop: 2, color: "#64748b" },

  switchArea:{ padding: "2px 10px 10px" },
  switchRow: { display: "flex", alignItems: "center", gap: 7, width: "100%", padding: "5px 8px", background: "transparent", border: "none", color: "#64748b", cursor: "pointer", fontSize: 11, borderRadius: 5, fontFamily: "'Plus Jakarta Sans', sans-serif", textAlign: "left", transition: "all 0.1s" },
  swDot:     { width: 7, height: 7, borderRadius: "50%", flexShrink: 0 },
  swName:    { color: "#94a3b8", fontWeight: 500, flex: 1 },
  swRole:    { fontSize: 10, fontWeight: 500, color: "#475569" },

  nav:    { padding: "8px 10px", borderTop: "1px solid #1e293b", display: "flex", flexDirection: "column", gap: 1 },
  navSection: { fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#334155", padding: "10px 12px 4px", marginTop: 4 },
  navBtn: { display: "flex", alignItems: "center", gap: 9, padding: "9px 10px", background: "transparent", border: "none", color: "#64748b", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif", textAlign: "left", transition: "all 0.1s" },
  navOn:  { background: "#1e293b", color: "#f1f5f9" },
  navIco: { fontSize: 14 },

  statPanel: { marginTop: "auto", padding: "14px 16px", borderTop: "1px solid #1e293b" },

  // Layout
  main:    { flex: 1, overflowY: "auto", background: "#f8fafc" },
  page:    { padding: "28px 32px", maxWidth: 1400 },
  pageHead:{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 },
  h1:      { fontSize: 22, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em" },
  sub:     { fontSize: 12, color: "#94a3b8", marginTop: 4 },
  addBtn:  { background: "#dc2626", color: "#fff", border: "none", borderRadius: 7, padding: "9px 18px", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif", flexShrink: 0 },

  filters:  { display: "flex", gap: 9, marginBottom: 22, flexWrap: "wrap" },
  searchBox:{ flex: 1, minWidth: 200, padding: "8px 13px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 7, color: "#0f172a", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" },
  sel:      { padding: "8px 11px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 7, color: "#374151", fontSize: 13, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" },

  // Lead cards
  cardGrid:  { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 14 },
  lCard:     { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", position: "relative" },
  stageStrip:{ height: 3, width: "100%" },
  lCardInner:{ padding: 16 },
  lTop:      { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  stagePill: { padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 },
  lValue:    { fontSize: 14, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" },
  lName:     { fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 2, letterSpacing: "-0.01em" },
  lCo:       { fontSize: 12, color: "#64748b", marginBottom: 3 },
  lType:     { fontSize: 12, color: "#94a3b8", marginBottom: 6, fontWeight: 500 },
  lAddr:     { fontSize: 12, color: "#64748b", marginBottom: 8, display: "flex", alignItems: "flex-start", gap: 4 },
  pin:       { flexShrink: 0 },
  lSpecs:    { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 },
  lFoot:     { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 10, borderTop: "1px solid #f1f5f9" },
  tagRow:    { display: "flex", gap: 4, flexWrap: "wrap" },
  assignChip:{ display: "flex", alignItems: "center", gap: 5 },
  unass:     { fontSize: 11, color: "#cbd5e1", fontStyle: "italic" },
  empty:     { padding: "36px", textAlign: "center", color: "#cbd5e1", fontSize: 13, gridColumn: "1/-1" },

  // Pipeline
  kanban:  { display: "flex", gap: 12, overflowX: "auto", paddingBottom: 24 },
  kCol:    { minWidth: 185, flex: 1, background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0", overflow: "hidden" },
  kColBar: { height: 3, width: "100%" },
  kColHead:{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 12px 3px" },
  kBadge:  { fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20 },
  kTotal:  { fontSize: 14, fontWeight: 800, padding: "2px 12px 10px", letterSpacing: "-0.02em" },
  kCard:   { background: "#f8fafc", margin: "0 8px 8px", borderRadius: 7, padding: 10, border: "1px solid #e2e8f0" },
  kName:   { fontSize: 12, fontWeight: 700, color: "#0f172a", marginBottom: 2 },
  kType:   { fontSize: 10, color: "#94a3b8", marginBottom: 4, fontWeight: 500 },
  kAddr:   { fontSize: 10, color: "#cbd5e1", marginBottom: 7 },
  kFoot:   { display: "flex", justifyContent: "space-between", alignItems: "center" },
  kMoney:  { fontSize: 11, fontWeight: 800, color: "#0f172a" },

  // Detail
  dNav:     { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 },
  backBtn:  { background: "#fff", border: "1px solid #e2e8f0", padding: "7px 14px", borderRadius: 7, cursor: "pointer", fontSize: 12, color: "#64748b", fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600 },
  editBtn:  { background: "#fff", color: "#0f172a", border: "1px solid #e2e8f0", padding: "7px 14px", borderRadius: 7, cursor: "pointer", fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600 },
  delBtn:   { background: "#fff", color: "#dc2626", border: "1px solid #fecaca", padding: "7px 14px", borderRadius: 7, cursor: "pointer", fontSize: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600 },
  confBar:  { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 7, padding: "10px 14px", marginBottom: 16, fontSize: 12, display: "flex", gap: 10, alignItems: "center", color: "#b91c1c" },
  confYes:  { background: "#dc2626", color: "#fff", border: "none", padding: "5px 12px", borderRadius: 5, cursor: "pointer", fontSize: 11, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700 },
  confNo:   { background: "#f1f5f9", color: "#64748b", border: "none", padding: "5px 12px", borderRadius: 5, cursor: "pointer", fontSize: 11, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600 },

  hero:       { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 22, marginBottom: 16, display: "flex", gap: 20, alignItems: "flex-start" },
  heroTop:    { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 },
  heroType:   { fontSize: 11, color: "#64748b", fontWeight: 600, background: "#f8fafc", padding: "3px 10px", borderRadius: 20, border: "1px solid #e2e8f0" },
  heroName:   { fontSize: 22, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em", marginBottom: 4 },
  heroCo:     { fontSize: 13, color: "#64748b", marginBottom: 4 },
  heroAddr:   { fontSize: 12, color: "#94a3b8", marginBottom: 8 },
  heroSpecs:  { display: "flex", gap: 12, flexWrap: "wrap" },
  heroVal:    { textAlign: "right", flexShrink: 0 },
  heroValNum: { fontSize: 26, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.04em" },
  heroValLbl: { fontSize: 9, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 3 },

  dCols:    { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 },
  infoCard: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 18 },
  cardLabel:{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em", color: "#94a3b8", marginBottom: 14 },
  iRow:     { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, marginBottom: 11, gap: 12 },
  iKey:     { color: "#64748b", flexShrink: 0 },
  iVal:     { color: "#0f172a", fontWeight: 500, textAlign: "right" },
  stageSel: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: "5px 8px", fontSize: 12, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, color: "#0f172a" },

  notesCard:   { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 18 },
  noteCompose: { display: "flex", gap: 10, marginBottom: 16, alignItems: "flex-start" },
  noteTa:      { flex: 1, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 7, padding: "10px 13px", color: "#0f172a", fontSize: 13, height: 68, fontFamily: "'Plus Jakarta Sans', sans-serif" },
  noteBtn:     { background: "#0f172a", color: "#fff", border: "none", borderRadius: 7, padding: "0 16px", cursor: "pointer", fontSize: 13, fontWeight: 700, flexShrink: 0, height: 68, fontFamily: "'Plus Jakarta Sans', sans-serif" },
  noteItem:    { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 7, padding: 14, marginBottom: 10 },
  noteHead:    { display: "flex", alignItems: "center", gap: 8, marginBottom: 8 },
  noteBody:    { fontSize: 13, color: "#334155", lineHeight: 1.7 },
  noteDate:    { fontSize: 11, color: "#94a3b8", marginLeft: "auto" },

  // Team
  teamGrid:    { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 },
  memberCard:  { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 18 },
  memberTop:   { display: "flex", alignItems: "center", gap: 12, marginBottom: 16 },
  mName:       { fontSize: 14, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.01em" },
  mRole:       { fontSize: 11, fontWeight: 600, marginTop: 2 },
  devNote:     { fontSize: 10, color: "#94a3b8", marginTop: 3 },
  activeTag:   { marginLeft: "auto", fontSize: 10, color: "#dc2626", fontWeight: 700, background: "#fef2f2", padding: "2px 8px", borderRadius: 20 },
  memberStatsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, background: "#f8fafc", borderRadius: 7, padding: "10px 12px", marginBottom: 12 },
  leadChip:    { display: "flex", alignItems: "center", gap: 7, padding: "7px 0", borderBottom: "1px solid #f1f5f9" },
  chipDot:     { width: 6, height: 6, borderRadius: "50%", flexShrink: 0 },
  chipName:    { fontSize: 12, color: "#64748b", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  chipVal:     { fontSize: 11, fontWeight: 700, color: "#0f172a" },
  smSwitch:    { background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0", padding: "5px 10px", borderRadius: 5, cursor: "pointer", fontSize: 11, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600 },
  smEdit:      { background: "#f8fafc", color: "#0f172a", border: "1px solid #e2e8f0", padding: "5px 10px", borderRadius: 5, cursor: "pointer", fontSize: 11, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600 },
  smDel:       { background: "#fff", color: "#dc2626", border: "1px solid #fecaca", padding: "5px 10px", borderRadius: 5, cursor: "pointer", fontSize: 11, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600 },

  // Modal
  overlay:   { position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 },
  modal:     { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 26, width: 580, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(15,23,42,0.15)" },
  mHead:     { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 },
  mTitle:    { fontSize: 18, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em" },
  mClose:    { background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#94a3b8", lineHeight: 1 },
  fLabel:    { display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "#64748b", marginBottom: 6 },
  fInput:    { width: "100%", padding: "9px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 7, color: "#0f172a", fontSize: 13, fontFamily: "'Plus Jakarta Sans', sans-serif" },
  mFoot:     { display: "flex", justifyContent: "flex-end", gap: 9, paddingTop: 10, borderTop: "1px solid #f1f5f9", marginTop: 4 },
  cancelBtn: { background: "#fff", border: "1px solid #e2e8f0", padding: "9px 18px", borderRadius: 7, cursor: "pointer", fontSize: 13, color: "#64748b", fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600 },
  saveBtn:   { background: "#dc2626", color: "#fff", border: "none", padding: "9px 22px", borderRadius: 7, cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif" },

  // View toggle
  viewToggle:    { display: "flex", background: "#f1f5f9", borderRadius: 7, padding: 3, gap: 2 },
  viewToggleBtn: { background: "none", border: "none", borderRadius: 5, padding: "5px 10px", cursor: "pointer", fontSize: 16, color: "#94a3b8", fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1 },
  viewToggleOn:  { background: "#fff", color: "#0f172a", boxShadow: "0 1px 3px rgba(15,23,42,0.1)" },

  // List view
  listWrap:   { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" },
  listHeader: { display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#94a3b8" },
  listRow:    { display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: "1px solid #f1f5f9", cursor: "pointer", transition: "background 0.1s" },
  listName:   { fontSize: 13, fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  listSub:    { fontSize: 11, color: "#94a3b8", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },

    toast: { position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "#0f172a", color: "#f8fafc", padding: "10px 20px", borderRadius: 8, fontSize: 13, zIndex: 200, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, boxShadow: "0 4px 16px rgba(15,23,42,0.25)" },

  // Sidebar sync bar
  syncBar:   { margin: "0 10px 14px", padding: "10px 12px", background: "#1e293b", borderRadius: 8, display: "flex", alignItems: "center", gap: 8 },
  syncDot:   { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  syncLabel: { fontSize: 11, color: "#94a3b8", fontWeight: 600 },
  syncTime:  { fontSize: 10, color: "#475569", marginTop: 1 },
  syncBtn:   { background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 2px", fontFamily: "'Plus Jakarta Sans', sans-serif" },

  // Settings page
  settingsCard:     { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 22, marginBottom: 16 },
  settingsCardHead: { display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 20 },
  settingsIcon:     { fontSize: 22, flexShrink: 0, marginTop: 2 },
  settingsCardTitle:{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 3 },
  settingsCardSub:  { fontSize: 13, color: "#64748b" },
  connBadge:        { marginLeft: "auto", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, flexShrink: 0 },
  syncStatusRow:    { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" },
  manualSyncBtn:    { marginLeft: "auto", background: "#0f172a", color: "#fff", border: "none", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" },
  stepRow:          { display: "flex", gap: 14, marginBottom: 14, alignItems: "flex-start" },
  stepNum:          { width: 26, height: 26, borderRadius: "50%", background: "#0f172a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0, marginTop: 1 },
  stepTitle:        { fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 2 },
  stepDesc:         { fontSize: 12, color: "#64748b", lineHeight: 1.5 },
  colChip:          { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 7, padding: "8px 10px" },
  colCode:          { display: "block", fontSize: 12, fontWeight: 700, color: "#0f172a", fontFamily: "monospace", marginBottom: 3 },
  colDesc:          { fontSize: 11, color: "#94a3b8" },
  copyBtn:          { background: "#0f172a", color: "#fff", border: "none", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "'Plus Jakarta Sans', sans-serif" },
  codeBlock:        { background: "#0f172a", color: "#e2e8f0", borderRadius: 8, padding: 16, fontSize: 11, lineHeight: 1.6, overflowX: "auto", fontFamily: "monospace", whiteSpace: "pre" },
};
