const SECTIONS = [
  { id: "10-A", title: "Grade 10 · Section A", students: [
    { id: "ava-patel", name: "Ava Patel" },
    { id: "noah-kim", name: "Noah Kim" },
    { id: "mia-chen", name: "Mia Chen" }
  ] },
  { id: "10-B", title: "Grade 10 · Section B", students: [
    { id: "leo-garcia", name: "Leo Garcia" },
    { id: "emma-wilson", name: "Emma Wilson" },
    { id: "oliver-jones", name: "Oliver Jones" }
  ] }
];
const GEOFENCE = {
  latitude: 8.4860705,
  longitude: 124.656805,
  radiusMeters: 200
};

const SUBJECTS_KEY = "tap-link-subjects";
const SECTIONS_KEY = "tap-link-sections";

function getSavedSections() {
  try {
    const saved = JSON.parse(localStorage.getItem(SECTIONS_KEY));
    if (Array.isArray(saved) && saved.length) {
      return SECTIONS.map((section) => {
        const savedSection = saved.find((candidate) => candidate.id === section.id);
        return savedSection ? { ...section, title: savedSection.title } : section;
      });
    }
  } catch {
    // Use the default section names.
  }
  return SECTIONS;
}

function getSavedSubjects() {
  try {
    const saved = JSON.parse(localStorage.getItem(SUBJECTS_KEY));
    return Array.isArray(saved) ? saved : ["Mathematics", "English", "Science"];
  } catch {
    return ["Mathematics", "English", "Science"];
  }
}

const state = {
  role: null,
  name: "",
  authMode: "signin",
  subjects: getSavedSubjects(),
  sections: getSavedSections(),
  sectionId: null,
  subject: null,
  attendance: {}
};

const ACCOUNTS_KEY = "tap-link-accounts";

function getAccounts() {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveAccounts(accounts) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function accountKey(role, name) {
  return `${role}:${name.toLowerCase()}`;
}

async function hashPassword(password) {
  if (window.crypto && window.crypto.subtle) {
    const bytes = new TextEncoder().encode(password);
    const digest = await window.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return password;
}

function setAuthError(message = "") {
  const error = document.querySelector("#auth-error");
  error.textContent = message;
  error.hidden = !message;
}

function setAuthMode(mode) {
  state.authMode = mode;
  const creating = mode === "create";
  document.querySelector("#sign-in-tab").classList.toggle("is-active", !creating);
  document.querySelector("#create-account-tab").classList.toggle("is-active", creating);
  document.querySelector("#sign-in-tab").setAttribute("aria-selected", String(!creating));
  document.querySelector("#create-account-tab").setAttribute("aria-selected", String(creating));
  document.querySelector("#auth-title").textContent = creating ? "Create your account" : "Sign in to continue";
  document.querySelector("#auth-description").textContent = creating
    ? "Choose a role and set a password."
    : "Use your name, role, and password.";
  document.querySelector("#password").autocomplete = creating ? "new-password" : "current-password";
  document.querySelector("#confirm-password").hidden = !creating;
  document.querySelector("#confirm-password-label").hidden = !creating;
  document.querySelector("#auth-submit").firstChild.textContent = creating ? "Create account " : "Sign in ";
  setAuthError();
}

document.querySelector("#sign-in-tab").addEventListener("click", () => setAuthMode("signin"));
document.querySelector("#create-account-tab").addEventListener("click", () => setAuthMode("create"));

const views = {
  login: document.querySelector("#login-view"),
  teacher: document.querySelector("#teacher-view"),
  student: document.querySelector("#student-view")
};
const accountBar = document.querySelector("#account-bar");
const accountLabel = document.querySelector("#account-label");
const sectionList = document.querySelector("#section-list");
const rosterPanel = document.querySelector("#roster-panel");
const rosterTitle = document.querySelector("#roster-title");
const teacherSubject = document.querySelector("#teacher-subject");
const studentRoster = document.querySelector("#student-roster");
const subjectList = document.querySelector("#subject-list");
const checkinPanel = document.querySelector("#checkin-panel");
const locationStatus = document.querySelector("#location-status");

document.querySelector("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const role = String(formData.get("role"));
  const name = String(formData.get("name")).trim();
  const password = String(formData.get("password"));
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (!name) {
    setAuthError("Enter your name.");
    return;
  }
  if (password.length < 6) {
    setAuthError("Password must be at least 6 characters.");
    return;
  }

  const accounts = getAccounts();
  const key = accountKey(role, name);
  const passwordHash = await hashPassword(password);

  if (state.authMode === "create") {
    if (password !== confirmPassword) {
      setAuthError("Passwords do not match.");
      return;
    }
    if (accounts[key]) {
      setAuthError("An account with this name and role already exists.");
      return;
    }
    accounts[key] = { name, role, passwordHash };
    saveAccounts(accounts);
  } else if (!accounts[key] || accounts[key].passwordHash !== passwordHash) {
    setAuthError("Incorrect name, role, or password.");
    return;
  }

  state.role = role;
  state.name = name;
  setAuthError();

  accountLabel.textContent = `${state.name} · ${state.role}`;
  accountBar.hidden = false;
  showView(state.role);
  if (state.role === "teacher") renderTeacher();
  else renderStudent();
});

document.querySelector("#logout-button").addEventListener("click", () => {
  state.role = null;
  state.sectionId = null;
  state.subject = null;
  checkinPanel.hidden = true;
  rosterPanel.hidden = true;
  accountBar.hidden = true;
  document.querySelector("#display-name").value = "Ava Patel";
  document.querySelector("#password").value = "";
  document.querySelector("#confirm-password").value = "";
  document.querySelector('input[name="role"][value="student"]').checked = true;
  setAuthMode("signin");
  showView("login");
});

function showView(name) {
  for (const [viewName, element] of Object.entries(views)) {
    element.hidden = viewName !== name;
  }
}

function attendanceKey(studentId, subject) {
  return `${studentId}:${subject}`;
}

function getAttendance(studentId, subject) {
  return state.attendance[attendanceKey(studentId, subject)] || "unmarked";
}

function setAttendance(studentId, subject, status) {
  state.attendance[attendanceKey(studentId, subject)] = status;
  renderTeacher();
  renderStudent();
}

function renderTeacher() {
  sectionList.replaceChildren(...state.sections.map((section) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "section-card";
    card.setAttribute("aria-pressed", String(state.sectionId === section.id));
    const icon = document.createElement("span");
    icon.className = "card-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "▤";
    const info = document.createElement("span");
    info.className = "card-info";
    const title = document.createElement("strong");
    title.textContent = section.title;
    const description = document.createElement("span");
    description.textContent = `${section.students.length} students · Tap to open roster`;
    info.append(title, description);
    const arrow = document.createElement("span");
    arrow.className = "card-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "→";
    card.append(icon, info, arrow);
    card.addEventListener("click", () => {
      state.sectionId = section.id;
      document.querySelector("#section-name").value = section.title;
      setSectionNameError();
      if (!state.subject || !state.subjects.includes(state.subject)) {
        state.subject = state.subjects[0] || null;
      }
      renderTeacher();
    });
    return card;
  }));

  teacherSubject.replaceChildren(...state.subjects.map((subject) => {
    const option = document.createElement("option");
    option.value = subject;
    option.textContent = subject;
    option.selected = state.subject === subject;
    return option;
  }));
  rosterPanel.hidden = !state.sectionId;
  if (!state.sectionId) return;

  const section = state.sections.find((candidate) => candidate.id === state.sectionId);
  rosterTitle.textContent = section.title;
  document.querySelector("#section-name").value = section.title;
  studentRoster.replaceChildren(...section.students.map((student) => renderStudentRow(student)));
}

function renderStudentRow(student) {
  const row = document.createElement("div");
  row.className = "student-row";
  const avatar = document.createElement("span");
  avatar.className = "avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = student.name.split(" ").map((part) => part[0]).join("");
  const name = document.createElement("span");
  name.className = "student-name";
  name.textContent = student.name;
  const actions = document.createElement("div");
  actions.className = "student-buttons";

  for (const [status, label, className] of [
    ["present", "Present", "button-present"],
    ["absent", "Absent", "button-absent"]
  ]) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `button ${className}${getAttendance(student.id, state.subject) === status ? " is-active" : ""}`;
    button.setAttribute("aria-pressed", String(getAttendance(student.id, state.subject) === status));
    button.textContent = label;
    button.addEventListener("click", () => setAttendance(student.id, state.subject, status));
    actions.append(button);
  }
  row.append(avatar, name, actions);
  return row;
}

teacherSubject.addEventListener("change", (event) => {
  state.subject = event.target.value;
  renderTeacher();
});

function setSectionNameError(message = "") {
  const error = document.querySelector("#section-error");
  error.textContent = message;
  error.hidden = !message;
}

document.querySelector("#save-section-name").addEventListener("click", () => {
  if (!state.sectionId) {
    setSectionNameError("Select a section first.");
    return;
  }
  const name = document.querySelector("#section-name").value.trim();
  if (!name) {
    setSectionNameError("Enter a section name.");
    return;
  }
  state.sections = state.sections.map((section) =>
    section.id === state.sectionId ? { ...section, title: name } : section
  );
  localStorage.setItem(SECTIONS_KEY, JSON.stringify(
    state.sections.map((section) => ({ id: section.id, title: section.title }))
  ));
  setSectionNameError();
  renderTeacher();
});

function saveSubjects() {
  localStorage.setItem(SUBJECTS_KEY, JSON.stringify(state.subjects));
}

function setSubjectError(message = "") {
  const error = document.querySelector("#subject-error");
  error.textContent = message;
  error.hidden = !message;
}

document.querySelector("#add-subject-button").addEventListener("click", () => {
  const input = document.querySelector("#new-subject");
  const name = input.value.trim();
  if (!name) {
    setSubjectError("Enter a subject name.");
    return;
  }
  if (state.subjects.some((subject) => subject.toLowerCase() === name.toLowerCase())) {
    setSubjectError("That subject already exists.");
    return;
  }
  state.subjects.push(name);
  state.subject = name;
  input.value = "";
  setSubjectError();
  saveSubjects();
  renderTeacher();
  renderStudent();
});

document.querySelector("#delete-subject-button").addEventListener("click", () => {
  if (!state.subject) {
    setSubjectError("No subject is selected.");
    return;
  }
  state.subjects = state.subjects.filter((subject) => subject !== state.subject);
  state.subject = state.subjects[0] || null;
  setSubjectError();
  saveSubjects();
  renderTeacher();
  renderStudent();
});

function renderStudent() {
  const demoStudent = state.sections[0].students[0];
  subjectList.replaceChildren(...state.subjects.map((subject, index) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "subject-card";
    card.setAttribute("aria-pressed", String(state.subject === subject));
    const icon = document.createElement("span");
    icon.className = "card-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = ["∑", "Aa", "⚛"][index];
    const info = document.createElement("span");
    info.className = "card-info";
    const title = document.createElement("strong");
    title.textContent = subject;
    const description = document.createElement("span");
    description.textContent = "Grade 10 · Section A";
    info.append(title, description);
    const status = document.createElement("span");
    const attendance = getAttendance(demoStudent.id, subject);
    status.className = `subject-state${attendance === "unmarked" ? "" : ` ${attendance}`}`;
    status.textContent = attendance === "unmarked" ? "Not marked" : attendance[0].toUpperCase() + attendance.slice(1);
    card.append(icon, info, status);
    card.addEventListener("click", () => {
      state.subject = subject;
      checkinPanel.hidden = false;
      document.querySelector("#checkin-title").textContent = subject;
      setLocationMessage("Checking your location…", "neutral");
      renderStudent();
      checkLocationAndCheckIn();
    });
    return card;
  }));
}

function setLocationMessage(message, type) {
  locationStatus.className = `location-status${type === "success" ? " is-success" : type === "error" ? " is-error" : ""}`;
  locationStatus.querySelector("span:last-child").textContent = message;
}

function markStudentPresent(source) {
  const demoStudent = state.sections[0].students[0];
  state.attendance[attendanceKey(demoStudent.id, state.subject)] = "present";
  setLocationMessage(source, "success");
  renderStudent();
}

function checkLocationAndCheckIn() {
  if (!navigator.geolocation) {
    setLocationMessage("Location isn’t available in this browser. You can still check in manually.", "error");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const distance = distanceInMeters(
        position.coords.latitude,
        position.coords.longitude,
        GEOFENCE.latitude,
        GEOFENCE.longitude
      );
      if (distance <= GEOFENCE.radiusMeters) {
        markStudentPresent("You’re inside the demo zone. Marked present automatically.");
      } else {
        setLocationMessage(`You’re about ${Math.round(distance)} m from the demo zone. You can still check in manually.`, "error");
      }
    },
    (error) => {
      const reason = error.code === error.PERMISSION_DENIED
        ? "Location permission was denied."
        : error.code === error.TIMEOUT
          ? "Location check timed out."
          : "Your location couldn’t be determined.";
      setLocationMessage(`${reason} You can still check in manually.`, "error");
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

function distanceInMeters(latitude1, longitude1, latitude2, longitude2) {
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const earthRadiusMeters = 6371000;
  const latitudeDelta = toRadians(latitude2 - latitude1);
  const longitudeDelta = toRadians(longitude2 - longitude1);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(latitude1)) * Math.cos(toRadians(latitude2))
    * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

document.querySelector("#location-button").addEventListener("click", () => {
  setLocationMessage("Checking your location…", "neutral");
  checkLocationAndCheckIn();
});

document.querySelector("#manual-present-button").addEventListener("click", () => {
  markStudentPresent("Marked present manually.");
});
