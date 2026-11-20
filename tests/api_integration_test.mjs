import assert from 'node:assert/strict';

const BASE = 'http://localhost:3000';
const ADMIN_CODE = process.env.ADMIN_ACCESS_CODE || 'ADMIN2026';
const TEACHER_CODE = process.env.TEACHER_ACCESS_CODE || 'TEACHER2026';

function createSessionClient(forwardedIp) {
  let cookieHeader = '';
  let lastSetCookies = [];

  async function request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (cookieHeader && !headers.Authorization) {
      headers.Cookie = cookieHeader;
    }
    if (forwardedIp) {
      headers['X-Forwarded-For'] = forwardedIp;
    }
    const res = await fetch(`${BASE}${path}`, { ...options, headers });
    const setCookies =
      typeof res.headers.getSetCookie === 'function'
        ? res.headers.getSetCookie()
        : res.headers.get('set-cookie')
        ? [res.headers.get('set-cookie')]
        : [];
    if (setCookies.length > 0) {
      lastSetCookies = setCookies;
      for (const sc of setCookies) {
        const pair = sc.split(';')[0];
        const eqIdx = pair.indexOf('=');
        if (eqIdx > 0) {
          const val = pair.slice(eqIdx + 1);
          cookieHeader = val ? pair : '';
        }
      }
    }
    const contentType = res.headers.get('content-type') || '';
    const body = contentType.includes('application/json') ? await res.json() : await res.text();
    return { status: res.status, body, headers: res.headers, setCookies };
  }

  return {
    request,
    getCookie: () => cookieHeader,
    setCookie: (c) => {
      cookieHeader = c;
    },
    getLastSetCookies: () => lastSetCookies,
  };
}

async function run() {
  let passed = 0;
  const check = (name, fn) =>
    fn().then(() => {
      passed++;
      console.log(`PASS: ${name}`);
    });

  // 1. Unauthorized requests blocked
  await check('Blocks unauthenticated requests with 401', async () => {
    const anon = createSessionClient('10.10.1.1');
    assert.equal((await anon.request('/api/auth/me')).status, 401);
    assert.equal((await anon.request('/api/students')).status, 401);
    assert.equal(
      (
        await anon.request('/api/marks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        })
      ).status,
      401
    );
    assert.equal((await anon.request('/api/dashboard')).status, 401);
  });

  // 2. Incorrect Admin and Teacher codes return 401 error
  await check('Rejects incorrect Admin and Teacher access codes with 401', async () => {
    const badAdmin = createSessionClient('10.10.1.2');
    const r1 = await badAdmin.request('/api/auth/code-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin', access_code: 'WRONG_ADMIN_CODE' }),
    });
    assert.equal(r1.status, 401);
    assert.match(r1.body.error, /Invalid Admin access code/i);

    const badTeacher = createSessionClient('10.10.1.3');
    const r2 = await badTeacher.request('/api/auth/code-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'teacher', access_code: 'WRONG_TEACHER_CODE' }),
    });
    assert.equal(r2.status, 401);
    assert.match(r2.body.error, /Invalid Teacher access code/i);
  });

  // 3. Correct Admin & Teacher codes create HttpOnly + Partitioned cookie AND Bearer session_token (iframe-safe)
  const admin = createSessionClient('10.10.1.10');
  const teacher = createSessionClient('10.10.1.11');
  await check('Authenticates Admin & Teacher via code-login with cookie and iframe-safe session_token', async () => {
    const adm = await admin.request('/api/auth/code-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-Proto': 'https' },
      body: JSON.stringify({ role: 'admin', access_code: ADMIN_CODE }),
    });
    assert.equal(adm.status, 200);
    assert.equal(adm.body.authenticated, true);
    assert.equal(adm.body.role, 'ADMIN');
    assert.ok(adm.body.session_token);
    assert.ok(
      adm.setCookies.some(
        (c) =>
          c.includes('edunova_session=') &&
          c.includes('HttpOnly') &&
          c.includes('SameSite=None') &&
          c.includes('Secure') &&
          c.includes('Partitioned')
      )
    );

    // Verify Bearer session_token works even if browser/iframe drops cookies
    const bareIframe = createSessionClient('10.10.1.10');
    const bearerMe = await bareIframe.request('/api/auth/me', {
      headers: { Authorization: `Bearer ${adm.body.session_token}` },
    });
    assert.equal(bearerMe.status, 200);
    assert.equal(bearerMe.body.role, 'ADMIN');

    const admMe = await admin.request('/api/auth/me');
    assert.equal(admMe.status, 200);
    assert.equal(admMe.body.role, 'ADMIN');
    assert.equal((await admin.request('/api/dashboard')).status, 200);

    const tch = await teacher.request('/api/auth/code-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'teacher', access_code: TEACHER_CODE }),
    });
    assert.equal(tch.status, 200);
    assert.equal(tch.body.authenticated, true);
    assert.equal(tch.body.role, 'TEACHER');
    assert.ok(tch.body.session_token);
    assert.ok(tch.setCookies.some((c) => c.includes('edunova_session=') && c.includes('HttpOnly')));

    const tchMe = await teacher.request('/api/auth/me');
    assert.equal(tchMe.status, 200);
    assert.equal(tchMe.body.role, 'TEACHER');
    assert.equal((await teacher.request('/api/dashboard')).status, 200);
  });

  // 4. Teacher accessing Admin APIs receives 403 Forbidden
  await check('Blocks Teacher from Admin-only APIs with 403 Forbidden', async () => {
    const createStu = await teacher.request('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Forbidden',
        roll_no: '99999',
        email: 'forbid@edu.test',
        course: 'B.Tech',
        branch: 'CSE',
        semester: 3,
      }),
    });
    assert.equal(createStu.status, 403);

    assert.equal((await teacher.request('/api/students/1', { method: 'DELETE' })).status, 403);
    assert.equal((await teacher.request('/api/subjects/1', { method: 'DELETE' })).status, 403);
    assert.equal((await teacher.request('/api/admin/access-codes')).status, 403);
    assert.equal(
      (
        await teacher.request('/api/admin/access-codes', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_role: 'TEACHER', new_code: 'HACKED123' }),
        })
      ).status,
      403
    );
    assert.equal((await teacher.request('/api/admin/db-health')).status, 403);
    assert.equal((await teacher.request('/api/export/students')).status, 403);
  });

  // 5. Admin CRUD + Teacher Marks/Results/Reports + Python grading + Access Code update
  let testStudentId = 0;
  let testSubjectId = 0;
  let testExamId = 0;
  await check('Admin full CRUD + Teacher marks/results/reports + Access Code update/restore', async () => {
    const created = await admin.request('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

    const sub = await admin.request('/api/subjects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject_name: 'Software Testing',
        subject_code: 'QA399',
        max_marks: 100,
        passing_marks: 40,
        semester: 3,
      }),
    });
    assert.equal(sub.status, 201);
    testSubjectId = sub.body.id;

    const ex = await admin.request('/api/examinations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exam_name: 'QA Audit Exam 2026',
        semester: 3,
        exam_date: '2026-12-01',
      }),
    });
    assert.equal(ex.status, 201);
    testExamId = ex.body.id;

    const saved = await teacher.request('/api/marks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: testStudentId,
        subject_id: testSubjectId,
        exam_id: testExamId,
        obtained_marks: 91,
      }),
    });
    assert.equal(saved.status, 201);

    const resData = await teacher.request(`/api/results/${testStudentId}?exam_id=${testExamId}`);
    assert.equal(resData.status, 200);
    assert.equal(resData.body.grade, 'A+');
    assert.equal(resData.body.status, 'PASS');

    // Admin inspects & updates Teacher access code, verifies login, then restores default
    const codeMeta = await admin.request('/api/admin/access-codes');
    assert.equal(codeMeta.status, 200);
    assert.equal(codeMeta.body.admin_code_configured, true);
    assert.equal(codeMeta.body.teacher_code_configured, true);
    assert.equal(JSON.stringify(codeMeta.body).includes(ADMIN_CODE), false);
    assert.equal(JSON.stringify(codeMeta.body).includes(TEACHER_CODE), false);

    const upd = await admin.request('/api/admin/access-codes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_role: 'TEACHER', new_code: 'TEACHER_NEW_99' }),
    });
    assert.equal(upd.status, 200);

    const tempTeacher = createSessionClient('10.10.1.12');
    const loginNew = await tempTeacher.request('/api/auth/code-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'teacher', access_code: 'TEACHER_NEW_99' }),
    });
    assert.equal(loginNew.status, 200);

    // Restore original Teacher code
    const restore = await admin.request('/api/admin/access-codes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_role: 'TEACHER', new_code: TEACHER_CODE }),
    });
    assert.equal(restore.status, 200);
  });

  // 6. Cleanup QA test records & verify Admin DB health + Python inspector
  await check('Admin DB health, Python inspector, and fixture cleanup succeed', async () => {
    const health = await admin.request('/api/admin/db-health');
    assert.equal(health.status, 200);
    assert.equal(health.body.connected, true);

    const py = await teacher.request('/api/python-structures/inspect');
    assert.equal(py.status, 200);
    assert.ok(Array.isArray(py.body.grade_ranges_tuple));

    assert.equal((await admin.request(`/api/students/${testStudentId}`, { method: 'DELETE' })).status, 200);
    assert.equal((await admin.request(`/api/subjects/${testSubjectId}`, { method: 'DELETE' })).status, 200);
    assert.equal((await admin.request(`/api/examinations/${testExamId}`, { method: 'DELETE' })).status, 200);
  });

  // 7. Logout terminates session, tampered cookie returns 401, and rate limiting returns 429
  await check('Logout terminates session, tampered cookie returns 401, and login rate-limits after 5 failures', async () => {
    const savedCookie = teacher.getCookie();
    const out = await teacher.request('/api/auth/logout', { method: 'POST' });
    assert.equal(out.status, 200);
    assert.equal(out.body.logged_out, true);

    teacher.setCookie(savedCookie);
    assert.equal((await teacher.request('/api/auth/me')).status, 401);
    assert.equal((await teacher.request('/api/students')).status, 401);

    const tampered = createSessionClient('10.10.1.20');
    tampered.setCookie('edunova_session=invalid.signature');
    assert.equal((await tampered.request('/api/auth/me')).status, 401);

    const brute = createSessionClient('10.10.99.99');
    for (let i = 0; i < 4; i++) {
      const r = await brute.request('/api/auth/code-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'admin', access_code: 'BAD_GUESS' }),
      });
      assert.equal(r.status, 401);
    }
    const r5 = await brute.request('/api/auth/code-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin', access_code: 'BAD_GUESS' }),
    });
    assert.equal(r5.status, 429);
  });

  console.log(`\nALL ${passed} LIVE API INTEGRATION SUITES PASSED`);
}

run().catch((err) => {
  console.error('INTEGRATION TEST FAILED:', err);
  process.exit(1);
});
