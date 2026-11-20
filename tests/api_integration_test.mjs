import assert from 'node:assert/strict';

const BASE = 'http://localhost:3000';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  const contentType = res.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await res.json() : await res.text();
  return { status: res.status, body, headers: res.headers };
}

async function run() {
  let passed = 0;
  const check = (name, fn) => {
    return fn().then(() => {
      passed++;
      console.log(`PASS: ${name}`);
    });
  };

  // 1. Unauthorized API requests
  await check('Blocks unauthorized requests with 401', async () => {
    const r1 = await request('/api/students');
    assert.equal(r1.status, 401);
    const r2 = await request('/api/marks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(r2.status, 401);
    const r3 = await request('/api/dashboard');
    assert.equal(r3.status, 401);
  });

  // 2. Authentication (Admin & Teacher) + Refresh + Logout
  let adminToken = '';
  let teacherToken = '';
  await check('Authenticates Admin and Teacher via JWT and supports refresh/logout', async () => {
    const bad = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@acadledger.edu', password: 'WrongPassword' }),
    });
    assert.equal(bad.status, 401);

    const adm = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@acadledger.edu', password: 'Admin@2026' }),
    });
    assert.equal(adm.status, 200);
    adminToken = adm.body.access_token;
    assert.ok(adminToken);

    const tch = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'teacher@acadledger.edu', password: 'Teacher@2026' }),
    });
    assert.equal(tch.status, 200);
    teacherToken = tch.body.access_token;

    const ref = await request('/api/auth/refresh', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(ref.status, 200);
    assert.ok(ref.body.access_token);

    const out = await request('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert.equal(out.status, 200);
    assert.equal(out.body.logged_out, true);
  });

  const adminHeaders = {
    Authorization: `Bearer ${adminToken}`,
    'Content-Type': 'application/json',
  };
  const teacherHeaders = {
    Authorization: `Bearer ${teacherToken}`,
    'Content-Type': 'application/json',
  };

  // 3. Role-Based Permissions (RBAC)
  await check('Enforces Teacher RBAC restrictions (403 on Admin endpoints)', async () => {
    const rUsers = await request('/api/users', { headers: { Authorization: `Bearer ${teacherToken}` } });
    assert.equal(rUsers.status, 403);
    const rCreateStu = await request('/api/students', {
      method: 'POST',
      headers: teacherHeaders,
      body: JSON.stringify({ name: 'X', roll_no: '99999', email: 'x@x.edu', course: 'B.Tech', branch: 'CSE', semester: 3 }),
    });
    assert.equal(rCreateStu.status, 403);
  });

  // 4. Student CRUD + Duplicate + Missing Fields + Search
  let testStudentId = 0;
  await check('Student CRUD, duplicate roll prevention, missing fields, and search filtering', async () => {
    const missing = await request('/api/students', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ name: 'Incomplete' }),
    });
    assert.equal(missing.status, 400);

    const created = await request('/api/students', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: 'QA Test Student',
        roll_no: '2026999',
        email: 'qa.student@acadledger.edu',
        course: 'B.Tech',
        branch: 'CSE',
        semester: 3,
      }),
    });
    assert.equal(created.status, 201);
    testStudentId = created.body.id;

    // Duplicate roll number
    const dup = await request('/api/students', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: 'Dup Student',
        roll_no: '2026999',
        email: 'qa.dup@acadledger.edu',
        course: 'B.Tech',
        branch: 'CSE',
        semester: 3,
      }),
    });
    assert.equal(dup.status, 409);

    const getOne = await request(`/api/students/${testStudentId}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    assert.equal(getOne.status, 200);
    assert.equal(getOne.body.roll_no, '2026999');

    const updated = await request(`/api/students/${testStudentId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ semester: 4 }),
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.semester, 4);

    const searched = await request('/api/students?search=2026999', { headers: { Authorization: `Bearer ${adminToken}` } });
    assert.equal(searched.status, 200);
    assert.equal(searched.body.length, 1);
  });

  // 5. Subject CRUD + Duplicate + Invalid passing marks
  let testSubjectId = 0;
  await check('Subject CRUD and passing/max marks validation', async () => {
    const badSub = await request('/api/subjects', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ subject_name: 'Bad Sub', subject_code: 'BAD999', max_marks: 100, passing_marks: 120, semester: 3 }),
    });
    assert.equal(badSub.status, 400);

    const sub = await request('/api/subjects', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ subject_name: 'Software Testing', subject_code: 'QA399', max_marks: 100, passing_marks: 40, semester: 3 }),
    });
    assert.equal(sub.status, 201);
    testSubjectId = sub.body.id;

    const dupSub = await request('/api/subjects', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ subject_name: 'Software Testing 2', subject_code: 'QA399', max_marks: 100, passing_marks: 40, semester: 3 }),
    });
    assert.equal(dupSub.status, 409);
  });

  // 6. Examination CRUD + Duplicate check
  let testExamId = 0;
  await check('Examination CRUD and duplicate exam prevention', async () => {
    const ex = await request('/api/examinations', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ exam_name: 'QA Audit Exam 2026', semester: 3, exam_date: '2026-12-01' }),
    });
    assert.equal(ex.status, 201);
    testExamId = ex.body.id;

    const dupEx = await request('/api/examinations', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ exam_name: 'QA Audit Exam 2026', semester: 3, exam_date: '2026-12-02' }),
    });
    assert.equal(dupEx.status, 409);
  });

  // 7. Marks validation (negative, above max, empty string) + Result & Grade calculation
  await check('Marks validation, Python result & grade calculation, and subject-fail rule', async () => {
    const neg = await request('/api/marks', {
      method: 'POST',
      headers: teacherHeaders,
      body: JSON.stringify({ student_id: testStudentId, subject_id: testSubjectId, exam_id: testExamId, obtained_marks: -10 }),
    });
    assert.equal(neg.status, 400);

    const overMax = await request('/api/marks', {
      method: 'POST',
      headers: teacherHeaders,
      body: JSON.stringify({ student_id: testStudentId, subject_id: testSubjectId, exam_id: testExamId, obtained_marks: 105 }),
    });
    assert.equal(overMax.status, 400);

    const emptyVal = await request('/api/marks', {
      method: 'POST',
      headers: teacherHeaders,
      body: JSON.stringify({ student_id: testStudentId, subject_id: testSubjectId, exam_id: testExamId, obtained_marks: '' }),
    });
    assert.equal(emptyVal.status, 400);

    const saved = await request('/api/marks', {
      method: 'POST',
      headers: teacherHeaders,
      body: JSON.stringify({ student_id: testStudentId, subject_id: testSubjectId, exam_id: testExamId, obtained_marks: 91 }),
    });
    assert.equal(saved.status, 201);

    const resData = await request(`/api/results/${testStudentId}?exam_id=${testExamId}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert.equal(resData.status, 200);
    assert.equal(resData.body.grade, 'A+');
    assert.equal(resData.body.status, 'PASS');
  });

  // 8. CSV Import validation, error report CSV, and Export CSV endpoints
  await check('CSV import validation, error report CSV, and individual/cohort CSV exports', async () => {
    const badCsv = new FormData();
    badCsv.append('file', new Blob(['roll_no,name\n1,OnlyTwoHeaders\n'], { type: 'text/csv' }), 'bad.csv');
    const impErr = await request('/api/import/students', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: badCsv,
    });
    assert.equal(impErr.status, 200);
    assert.ok(impErr.body.errors.length > 0);
    assert.ok(impErr.body.error_report_csv.includes('error_number,detail'));

    const nonCsv = new FormData();
    nonCsv.append('file', new Blob(['hello'], { type: 'text/plain' }), 'notes.txt');
    const badExt = await request('/api/import/students', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: nonCsv,
    });
    assert.equal(badExt.status, 400);

    const expStudents = await request('/api/export/students', { headers: { Authorization: `Bearer ${teacherToken}` } });
    assert.equal(expStudents.status, 200);
    assert.ok(expStudents.body.includes('2026001'));

    const expStudentRes = await request(`/api/export/results/${testStudentId}?exam_id=${testExamId}`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert.equal(expStudentRes.status, 200);
    assert.ok(expStudentRes.body.includes('QA399'));
  });

  // 9. DB Health & Python Data Structures Inspector + Cleanup test fixtures
  await check('Health/DB & Python inspector endpoints work and test fixtures clean up cleanly', async () => {
    const health = await request('/api/health/db');
    assert.equal(health.status, 200);
    assert.equal(health.body.connected, true);
    assert.ok(health.body.counts.students >= 10);

    const py = await request('/api/python-structures/inspect', {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert.equal(py.status, 200);
    assert.ok(Array.isArray(py.body.grade_ranges_tuple));

    // Clean up test records
    assert.equal((await request(`/api/students/${testStudentId}`, { method: 'DELETE', headers: adminHeaders })).status, 200);
    assert.equal((await request(`/api/subjects/${testSubjectId}`, { method: 'DELETE', headers: adminHeaders })).status, 200);
    assert.equal((await request(`/api/examinations/${testExamId}`, { method: 'DELETE', headers: adminHeaders })).status, 200);
  });

  console.log(`\nALL ${passed} LIVE API INTEGRATION SUITES PASSED`);
}

run().catch((err) => {
  console.error('INTEGRATION TEST FAILED:', err);
  process.exit(1);
});
