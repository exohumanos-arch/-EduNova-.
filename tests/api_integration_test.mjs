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
  const check = (name, fn) =>
    fn().then(() => {
      passed++;
      console.log(`PASS: ${name}`);
    });

  // 1. Direct open API access without authentication
  await check('Allows direct access to Dashboard, Students, Subjects, and Examinations without login', async () => {
    assert.equal((await request('/api/dashboard')).status, 200);
    assert.equal((await request('/api/students')).status, 200);
    assert.equal((await request('/api/subjects')).status, 200);
    assert.equal((await request('/api/examinations')).status, 200);
    assert.equal((await request('/api/admin/db-health')).status, 200);
  });

  // 2. Student, Subject, Examination, Marks CRUD + Python Grading + CSV Exports
  let testStudentId = 0;
  let testSubjectId = 0;
  let testExamId = 0;

  await check('Full CRUD, validation, Python grading, and CSV exports succeed directly', async () => {
    const created = await request('/api/students', {
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

    const dup = await request('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Dup',
        roll_no: '2026999',
        email: 'qa.dup@acadledger.edu',
        course: 'B.Tech',
        branch: 'CSE',
        semester: 3,
      }),
    });
    assert.equal(dup.status, 409);

    const sub = await request('/api/subjects', {
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

    const ex = await request('/api/examinations', {
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

    const badMark = await request('/api/marks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: testStudentId,
        subject_id: testSubjectId,
        exam_id: testExamId,
        obtained_marks: 105,
      }),
    });
    assert.equal(badMark.status, 400);

    const saved = await request('/api/marks', {
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

    const resData = await request(`/api/results/${testStudentId}?exam_id=${testExamId}`);
    assert.equal(resData.status, 200);
    assert.equal(resData.body.grade, 'A+');
    assert.equal(resData.body.status, 'PASS');

    const expStudents = await request('/api/export/students');
    assert.equal(expStudents.status, 200);
    assert.ok(expStudents.body.includes('2026001'));

    const expStudentRes = await request(`/api/export/results/${testStudentId}?exam_id=${testExamId}`);
    assert.equal(expStudentRes.status, 200);
    assert.ok(expStudentRes.body.includes('QA399'));
  });

  // 3. Python structures & fixture cleanup
  await check('Python inspector and test fixture cleanup succeed', async () => {
    const py = await request('/api/python-structures/inspect');
    assert.equal(py.status, 200);
    assert.ok(Array.isArray(py.body.grade_ranges_tuple));

    assert.equal((await request(`/api/students/${testStudentId}`, { method: 'DELETE' })).status, 200);
    assert.equal((await request(`/api/subjects/${testSubjectId}`, { method: 'DELETE' })).status, 200);
    assert.equal((await request(`/api/examinations/${testExamId}`, { method: 'DELETE' })).status, 200);
  });

  console.log(`\nALL ${passed} LIVE API INTEGRATION SUITES PASSED`);
}

run().catch((err) => {
  console.error('INTEGRATION TEST FAILED:', err);
  process.exit(1);
});
