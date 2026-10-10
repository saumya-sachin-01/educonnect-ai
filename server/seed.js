// Seed script — creates fictional demo data. Idempotent: skips if DB already has users.
// Run `node seed.js --reset` to wipe and re-seed.
import { db, initSchema, run, get, isSeeded } from './db.js';
import { hashPassword } from './auth.js';

initSchema();

const isDirectRun = Boolean(process.argv[1] && process.argv[1].endsWith('seed.js'));

if (isDirectRun && isSeeded() && !process.argv.includes('--reset')) {
  console.log('Database already seeded. Use `node seed.js --reset` to recreate demo data.');
  process.exit(0);
}

if (process.argv.includes('--reset')) {
  console.log('Resetting demo data...');
  db.exec(`
    DELETE FROM question_replies; DELETE FROM questions; DELETE FROM notifications;
    DELETE FROM announcements; DELETE FROM grades; DELETE FROM submissions;
    DELETE FROM assignments; DELETE FROM notes; DELETE FROM enrollments;
    DELETE FROM courses; DELETE FROM subjects; DELETE FROM activity_log; DELETE FROM users;
    DELETE FROM sqlite_sequence;
  `);
}

const daysFromNow = (d, hour = 23) => {
  const t = new Date(Date.now() + d * 86400000);
  t.setHours(hour, 59, 0, 0);
  return t.toISOString().replace('T', ' ').slice(0, 19);
};

export function seed() {
  const adminHash = hashPassword('admin123');
  const facultyHash = hashPassword('faculty123');
  const studentHash = hashPassword('student123');

  const insUser = db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)");
  insUser.run('Dr. Arvind Menon', 'admin@educonnect.demo', adminHash, 'admin');
  insUser.run('Dr. Ram Sharma', 'ram.sharma@educonnect.demo', facultyHash, 'faculty');
  insUser.run('Dr. Priya Nair', 'priya.nair@educonnect.demo', facultyHash, 'faculty');

  const students = [
    ['Aarav Patel', 'aarav.patel@educonnect.demo'],
    ['Diya Singh', 'diya.singh@educonnect.demo'],
    ['Kabir Khan', 'kabir.khan@educonnect.demo'],
    ['Meera Iyer', 'meera.iyer@educonnect.demo'],
    ['Rohan Verma', 'rohan.verma@educonnect.demo'],
  ];
  for (const [name, email] of students) insUser.run(name, email, studentHash, 'student');

  const insSubject = db.prepare('INSERT INTO subjects (name, code) VALUES (?,?)');
  insSubject.run('Data Structures', 'CS201');
  insSubject.run('Database Systems', 'CS301');
  insSubject.run('Computer Networks', 'CS302');

  const insCourse = db.prepare('INSERT INTO courses (name, code, subject_id, faculty_id, description) VALUES (?,?,?,?,?)');
  insCourse.run('Data Structures — Section A', 'CS201-A', 1, 2, 'Arrays, linked lists, stacks, queues, trees and graphs with problem-solving labs.');
  insCourse.run('Database Systems — Section B', 'CS301-B', 2, 2, 'Relational model, SQL, normalization, transactions and NoSQL overview.');
  insCourse.run('Computer Networks — Section A', 'CS302-A', 3, 3, 'OSI/TCP-IP stack, routing, transport protocols and application-layer services.');

  const insEnroll = db.prepare('INSERT INTO enrollments (course_id, student_id) VALUES (?,?)');
  // student ids 4..8 ; course enrollments
  const enrollMap = {
    1: [4, 5, 6, 7],   // Aarav, Diya, Kabir, Meera in DS
    2: [4, 5, 8],      // Aarav, Diya, Rohan in DB
    3: [6, 7, 8],      // Kabir, Meera, Rohan in CN
  };
  for (const [cid, sids] of Object.entries(enrollMap)) for (const sid of sids) insEnroll.run(+cid, sid);

  const insAssign = db.prepare('INSERT INTO assignments (course_id, title, description, max_marks, deadline, created_by) VALUES (?,?,?,?,?,?)');
  insAssign.run(1, 'Linked List Implementation Lab', 'Implement singly and doubly linked lists in C or Python with insert, delete and search. Include a brief complexity analysis of each operation.', 50, daysFromNow(-2), 2);
  insAssign.run(1, 'Binary Tree Traversal Exercise', 'Write recursive and iterative solutions for in-order, pre-order and post-order traversal. Submit code plus a sample run on the provided tree.', 40, daysFromNow(4), 2);
  insAssign.run(1, 'Sorting Algorithm Comparison', 'Compare quicksort, mergesort and heapsort on the provided dataset. Report comparisons, swaps and running time in a short table.', 60, daysFromNow(9), 2);
  insAssign.run(2, 'SQL Queries Assignment 1', 'Write SQL for the university schema: 8 queries covering SELECT, JOIN, GROUP BY and sub-queries. Paste queries with expected output.', 30, daysFromNow(2), 2);
  insAssign.run(2, 'Normalization Case Study', 'Normalize the given invoice table to 3NF. Show each normal form step with justification.', 45, daysFromNow(7), 2);
  insAssign.run(3, 'Subnetting Worksheet', 'Solve 10 subnetting problems: given a network address and mask, find network, broadcast and usable host ranges.', 25, daysFromNow(-1), 3);
  insAssign.run(3, 'TCP vs UDP Analysis Report', 'One-page report comparing TCP and UDP using two real application examples each. Include header diagrams.', 35, daysFromNow(5), 3);

  const insSub = db.prepare('INSERT INTO submissions (assignment_id, student_id, answer, submitted_at) VALUES (?,?,?,?)');
  const insGrade = db.prepare('INSERT INTO grades (submission_id, marks, feedback, graded_by) VALUES (?,?,?,?)');
  // Graded submissions
  insSub.run(1, 4, 'Singly linked list implemented with head/tail pointers. Insert at head and tail is O(1); search is O(n). Doubly linked list adds prev pointers so deletion is O(1) given the node. Code attached as text with test runs on 5, 10 and 20 elements.', daysFromNow(-3, 20));
  insGrade.run(1, 44, 'Excellent work — clean implementation and correct complexity discussion. Minor: discuss cache effects of pointer chasing for full marks.', 2);
  insSub.run(1, 5, 'Implemented both list types in Python. Included edge-case tests for empty list and single node. Complexity analysis: insert O(1) at head, O(n) at tail without tail pointer.', daysFromNow(-2, 21));
  insGrade.run(2, 47, 'Very thorough tests. Remember to mention why a tail pointer makes append O(1). Top marks.', 2);
  insSub.run(6, 6, 'All 10 subnet problems solved. Working shown for binary AND operations. Ranges verified with an online calculator.', daysFromNow(-2, 18));
  insGrade.run(3, 21, 'Good accuracy on 9/10. Problem 7 used the wrong block size — review powers of two for host bits.', 3);
  insSub.run(6, 7, 'Completed worksheet. Took /27 from problem 4 and showed usable range 192.168.4.33–62 correctly.', daysFromNow(-1, 10));
  insGrade.run(4, 23, 'Full working shown and correct. Well done.', 3);
  // Submitted, ungraded
  insSub.run(2, 4, 'Recursive traversals plus an iterative in-order using an explicit stack. Sample run printed for tree {5,3,8,1,4}. Included complexity O(n) time, O(h) space.', daysFromNow(-1, 22));
  insSub.run(1, 6, 'C implementation of singly linked list with menu-driven test. Delete handles both head and middle cases.', daysFromNow(-1, 20));
  // Pending: students 7,8 on assignment 1 etc. left without submissions.

  const insNote = db.prepare('INSERT INTO notes (course_id, title, description, content, created_by) VALUES (?,?,?,?,?)');
  insNote.run(1, 'Stacks and Queues — Quick Reference', 'One-page cheat sheet for LIFO/FIFO structures and their classic applications.', `STACK (LIFO — Last In, First Out)\n- push(x): add to top — O(1)\n- pop(): remove top — O(1)\n- peek(): view top — O(1)\n- Applications: undo/redo, expression evaluation, recursion, bracket matching, DFS.\n\nQUEUE (FIFO — First In, First Out)\n- enqueue(x): add to rear — O(1)\n- dequeue(): remove front — O(1)\n- Applications: task scheduling, BFS, request buffering, print queues.\n\nDEQUE: insert/remove at both ends.\nPriority queue: dequeue by priority, usually backed by a heap — O(log n).\n\nExam tip: always state the complexity of each operation and give ONE concrete application example.`, 2);
  insNote.run(1, 'Binary Search Trees — Study Notes', 'BST properties, rotations and balancing intuition with examples.', `BST PROPERTY: for every node, left subtree values < node < right subtree values.\n\nOperations:\n- Search: O(h) — O(log n) if balanced, O(n) if skewed.\n- Insert: search for the position, attach new node — O(h).\n- Delete: 3 cases — leaf, one child, two children (replace with in-order successor).\n\nBalancing:\n- AVL tree: heights of subtrees differ by at most 1; rotations restore balance.\n- Red-Black tree: looser balance, faster inserts, used in many stdlib implementations.\n\nTraversal gives sorted order: in-order traversal of a BST = ascending sequence.`, 2);
  insNote.run(2, 'SQL Joins Visual Guide', 'Inner, left, right and full outer joins explained with Venn intuition and examples.', `-- INNER JOIN: only matching rows from both tables\nSELECT s.name, e.grade FROM students s\nINNER JOIN enrollments e ON e.student_id = s.id;\n\n-- LEFT JOIN: ALL left rows, NULLs where no match\nSELECT s.name, e.grade FROM students s\nLEFT JOIN enrollments e ON e.student_id = s.id;\n\n-- RIGHT JOIN: all right rows kept.\n-- FULL OUTER JOIN: everything from both sides (SQLite: use UNION of left/right).\n\nRemember: JOIN conditions go in ON; filtering aggregated groups goes in HAVING after GROUP BY.`, 2);
  insNote.run(2, 'Normalization 1NF to 3NF', 'Step-by-step normalization recipe with a worked example.', `Goal: remove redundancy and update anomalies.\n\n1NF: atomic values only — no lists or repeating groups in a cell.\n2NF: 1NF + every non-key attribute depends on the WHOLE primary key (no partial dependency).\n3NF: 2NF + no transitive dependency (non-key must not depend on another non-key).\n\nWorked example: INVOICE(invoice_no, date, cust_id, cust_city, item, qty)\n- 1NF: split items into INVOICE_LINE(invoice_no, item, qty).\n- 2NF: customer data depends only on invoice, not item → split CUSTOMER(cust_id, city).\n- 3NF: city depends on cust_id (a non-key here) → keep in CUSTOMER, done.\n\nExam tip: state the anomaly you are removing (insert, update, delete) at each step.`, 2);
  insNote.run(3, 'TCP Handshake & Teardown', 'The 3-way handshake and 4-way teardown, with sequence numbers.', `3-WAY HANDSHAKE:\n1. Client → SYN (seq = x)\n2. Server → SYN-ACK (seq = y, ack = x+1)\n3. Client → ACK (ack = y+1) — connection ESTABLISHED\n\nWhy three? Both sides must prove they can send AND receive.\n\n4-WAY TEARDOWN:\n1. Client → FIN\n2. Server → ACK\n3. Server → FIN (after closing its side)\n4. Client → ACK, waits TIME_WAIT (2×MSL) to catch strayed packets.\n\nFields to know: seq number, ack number, SYN, ACK, FIN flags, window size (flow control).`, 3);
  insNote.run(3, 'Subnetting in 5 Steps', 'A repeatable method for any subnetting problem.', `STEP 1: Write the mask in binary; count host bits h.\nSTEP 2: Block size = 2^h.\nSTEP 3: Network address = IP AND mask (align to block boundary).\nSTEP 4: Broadcast = network + block size − 1.\nSTEP 5: Usable hosts = network+1 … broadcast−1 (2^h − 2 hosts).\n\nExample: 192.168.4.77 /27\n- /27 → 5 host bits → block 32 → networks at .0, .32, .64, .96\n- 77 is in the .64 block → network 192.168.4.64, broadcast 192.168.4.95\n- Usable: 192.168.4.65 – 192.168.4.94 (30 hosts)\n\nPractice: repeat with /26, /28, /30 until automatic.`, 3);

  const insQ = db.prepare('INSERT INTO questions (course_id, student_id, title, body, status) VALUES (?,?,?,?,?)');
  const insR = db.prepare('INSERT INTO question_replies (question_id, user_id, body) VALUES (?,?,?)');
  insQ.run(1, 4, 'Why is BST search O(log n) but worst case O(n)?', 'If balanced, every comparison halves the data, so O(log n). But what exactly makes a BST unbalanced — is it insertion order? How do AVL rotations fix it without breaking the BST property?', 'answered');
  insR.run(1, 2, 'Yes — insertion order is the culprit. Sorted input (1,2,3,4,5) degenerates the tree into a chain, giving O(n). AVL fixes this by rotating whenever a node\'s balance factor exceeds ±1: rotations only rearrange three nodes locally, so the BST ordering invariant is preserved while depth stays O(log n). Practice: insert 10,20,30 and draw the left rotation at 20.');
  insQ.run(2, 5, 'Difference between WHERE and HAVING?', 'Both filter rows — when do I use which? My query errors when I put an aggregate in WHERE.', 'answered');
  insR.run(2, 2, 'WHERE filters rows BEFORE grouping (aggregates not allowed), HAVING filters AFTER GROUP BY (aggregates allowed). Rule of thumb: condition on a column → WHERE; condition on COUNT/SUM/AVG → HAVING. Example: WHERE status=\'active\' GROUP BY course HAVING COUNT(*) > 10.');
  insQ.run(3, 8, 'Is UDP really used for anything important?', 'TCP seems strictly better since it is reliable. Where does UDP actually win?', 'open');
  insR.run(3, 3, 'Great question — reliability is not free. UDP wins where latency matters more than perfect delivery: live video/voice (a retransmitted packet arrives too late), online games (state updates), and DNS lookups (tiny request/response where the handshake would dominate). Compare header sizes too: UDP 8 bytes vs TCP 20+.');

  const insAnn = db.prepare('INSERT INTO announcements (title, body, course_id, created_by) VALUES (?,?,?,?)');
  insAnn.run('Mid-semester exam schedule published', 'Mid-semester examinations run from next Monday. The seating plan is on the department notice board. Reach out to your course faculty for syllabus clarifications.', null, 2);
  insAnn.run('CS201 lab submissions moved to online', 'All pending CS201 lab work must now be submitted through EduConnect before the deadline. No email submissions will be graded.', 1, 2);
  insAnn.run('Guest lecture: Modern Networking', 'Industry talk on SDN and 5G core networks this Friday, 3 PM, Main Auditorium. Attendance counts toward CS302 participation credit.', 3, 3);

  const insNotif = db.prepare('INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)');
  insNotif.run(4, 'grade', 'Assignment graded: Linked List Implementation Lab', 'Dr. Ram Sharma graded your submission — 44/50. View feedback in Assignments.', '/student/assignments');
  insNotif.run(4, 'announcement', 'Announcement: Mid-semester exam schedule published', 'Mid-semester examinations run from next Monday.', '/student/dashboard');
  insNotif.run(4, 'assignment', 'New assignment: Binary Tree Traversal Exercise', 'Due in 4 days — 40 marks.', '/student/assignments');
  insNotif.run(5, 'grade', 'Assignment graded: Linked List Implementation Lab', 'Dr. Ram Sharma graded your submission — 47/50. View feedback in Assignments.', '/student/assignments');
  insNotif.run(5, 'reply', 'Your question received a reply', 'Dr. Ram Sharma replied to "Difference between WHERE and HAVING?".', '/student/doubts');
  insNotif.run(6, 'grade', 'Assignment graded: Subnetting Worksheet', 'Dr. Priya Nair graded your submission — 21/25. View feedback in Assignments.', '/student/assignments');
  insNotif.run(7, 'grade', 'Assignment graded: Subnetting Worksheet', 'Dr. Priya Nair graded your submission — 23/25. View feedback in Assignments.', '/student/assignments');
  insNotif.run(8, 'announcement', 'Announcement: Guest lecture: Modern Networking', 'This Friday 3 PM, Main Auditorium.', '/student/dashboard');
  insNotif.run(2, 'question', 'New student question in CS302-A', 'Rohan Verma asked: "Is UDP really used for anything important?"', '/faculty/doubts');
  insNotif.run(2, 'submission', 'New submission: Binary Tree Traversal Exercise', 'Aarav Patel submitted an answer.', '/faculty/assignments');

  const insLog = db.prepare('INSERT INTO activity_log (user_id, action, detail) VALUES (?,?,?)');
  insLog.run(2, 'assignment.created', 'Created "Binary Tree Traversal Exercise" (CS201-A)');
  insLog.run(2, 'grade.posted', 'Graded Aarav Patel — Linked List Implementation Lab (44/50)');
  insLog.run(2, 'grade.posted', 'Graded Diya Singh — Linked List Implementation Lab (47/50)');
  insLog.run(3, 'grade.posted', 'Graded Kabir Khan — Subnetting Worksheet (21/25)');
  insLog.run(3, 'grade.posted', 'Graded Meera Iyer — Subnetting Worksheet (23/25)');
  insLog.run(4, 'submission.created', 'Submitted "Binary Tree Traversal Exercise"');
  insLog.run(4, 'question.created', 'Asked "Why is BST search O(log n) but worst case O(n)?"');
  insLog.run(8, 'question.created', 'Asked "Is UDP really used for anything important?"');
}

// Run when executed directly
if (isDirectRun) {
  seed();
  const counts = {
    users: get('SELECT COUNT(*) n FROM users').n,
    courses: get('SELECT COUNT(*) n FROM courses').n,
    assignments: get('SELECT COUNT(*) n FROM assignments').n,
    submissions: get('SELECT COUNT(*) n FROM submissions').n,
    notes: get('SELECT COUNT(*) n FROM notes').n,
  };
  console.log('Demo data ready (fictional):', counts);
}
