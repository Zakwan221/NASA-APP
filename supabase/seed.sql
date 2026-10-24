-- Sample quiz for testing Module 3. Safe to run more than once.
-- Add the real question bank (10 per story) the same way.

insert into public.quizzes (id, title, story)
values ('00000000-0000-4000-8000-000000000001', 'Solar System Tour', 'solar-system')
on conflict (id) do nothing;

insert into public.questions (quiz_id, position, prompt, choices, correct_index, fact)
values
  ('00000000-0000-4000-8000-000000000001', 0,
   'Which planet is closest to the Sun?',
   '["Venus", "Mercury", "Mars", "Earth"]', 1,
   'Mercury is the smallest planet and the closest to the Sun. A year there lasts just 88 Earth days.'),
  ('00000000-0000-4000-8000-000000000001', 1,
   'What is the largest planet in our solar system?',
   '["Saturn", "Neptune", "Jupiter", "Uranus"]', 2,
   'Jupiter is more than twice as massive as all the other planets combined.'),
  ('00000000-0000-4000-8000-000000000001', 2,
   'Which planet is called the Red Planet?',
   '["Mars", "Venus", "Mercury", "Jupiter"]', 0,
   'Mars looks red because its dust and rocks are rich in iron oxide, which is rust.'),
  ('00000000-0000-4000-8000-000000000001', 3,
   'About how long does sunlight take to reach Earth?',
   '["8 seconds", "8 hours", "8 days", "8 minutes"]', 3,
   'Sunlight travels about 150 million km to reach Earth, which takes roughly 8 minutes and 20 seconds.'),
  ('00000000-0000-4000-8000-000000000001', 4,
   'Which is the hottest planet in our solar system?',
   '["Mercury", "Venus", "Mars", "Jupiter"]', 1,
   'Venus is hotter than Mercury even though it is farther from the Sun: its thick carbon dioxide air traps heat, making it hot enough to melt lead.'),
  ('00000000-0000-4000-8000-000000000001', 5,
   'In 2022, NASA''s DART spacecraft crashed into an asteroid on purpose. Why?',
   '["To mine it for metals", "To test pushing an asteroid off course", "To land astronauts on it", "To collect a rock sample"]', 1,
   'DART hit Dimorphos, a small moon of the asteroid Didymos, and shortened its orbit by about half an hour. It was the first test of planetary defense.')
on conflict (quiz_id, position) do nothing;
