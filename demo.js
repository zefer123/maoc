'use strict';

const filter = document.getElementById('status');
const count = document.getElementById('mission-count');
const missions = [...document.querySelectorAll('#missions details')];

function filterMissions() {
  let visible = 0;
  for (const mission of missions) {
    mission.hidden = filter.value !== 'all' && mission.dataset.status !== filter.value;
    if (!mission.hidden) visible += 1;
  }
  count.textContent = `${visible} ภารกิจตัวอย่าง`;
}

filter.form.addEventListener('submit', (event) => event.preventDefault());
filter.addEventListener('change', filterMissions);
filterMissions();