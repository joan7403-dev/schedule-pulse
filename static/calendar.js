document.addEventListener('DOMContentLoaded', function () {
    const DAYS = ['일','월','화','수','목','금','토'];
    const selectedDates = new Set();
    let calDate = new Date();

    function fmtDate(d) {
        return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    }
    function dayName(ds) { return DAYS[new Date(ds+'T00:00:00').getDay()]; }

    function renderCalendar() {
        const year = calDate.getFullYear();
        const month = calDate.getMonth();
        document.getElementById('calTitle').textContent = `${year}년 ${month + 1}월`;
        const firstDay = new Date(year, month, 1).getDay();
        const lastDate = new Date(year, month + 1, 0).getDate();
        const today = new Date(); today.setHours(0,0,0,0);

        let html = '<div class="grid grid-cols-7 gap-1 mb-2">';
        ['SUN','MON','TUE','WED','THU','FRI','SAT'].forEach(d => {
            html += `<div class="text-[9px] font-black text-slate-300 text-center py-2">${d}</div>`;
        });
        html += '</div><div class="grid grid-cols-7 gap-2">';

        for (let i = 0; i < firstDay; i++) html += '<div class="aspect-square"></div>';

        for (let d = 1; d <= lastDate; d++) {
            const dt = new Date(year, month, d);
            const ds = fmtDate(dt);
            const past = dt < today;
            const isSelected = selectedDates.has(ds);
            let cls = "aspect-square flex items-center justify-center text-sm font-bold rounded-xl cursor-pointer transition-all ";
            if (past) cls += "text-slate-200 cursor-not-allowed";
            else if (isSelected) cls += "bg-primary text-white shadow-md shadow-primary/20";
            else cls += "bg-white text-slate-700 hover:bg-slate-100";

            if (!past) {
                html += `<div class="${cls}" data-date="${ds}">${d}</div>`;
            } else {
                html += `<div class="${cls}">${d}</div>`;
            }
        }
        html += '</div>';
        document.getElementById('calendar').innerHTML = html;

        document.querySelectorAll('#calendar [data-date]').forEach(cell => {
            cell.addEventListener('click', () => {
                const ds = cell.dataset.date;
                if (selectedDates.has(ds)) selectedDates.delete(ds);
                else selectedDates.add(ds);
                renderCalendar();
                updateTags();
            });
        });
    }

    function updateTags() {
        const sorted = Array.from(selectedDates).sort();
        const el = document.getElementById('selectedDates');
        const hidden = document.getElementById('hiddenDates');
        document.getElementById('submitCreate').disabled = sorted.length === 0;

        if (sorted.length === 0) {
            el.innerHTML = '<p class="text-[10px] text-slate-300 font-bold italic py-4">선택된 날짜가 없습니다.</p>';
            hidden.innerHTML = '';
            return;
        }

        let tags = '<div class="flex flex-wrap gap-2 pt-4">';
        let inputs = '';
        sorted.forEach(ds => {
            tags += `<span class="bg-primary/10 text-primary text-[10px] font-black px-3 py-1.5 rounded-lg flex items-center gap-1">
                ${ds} (${dayName(ds)})
                <button type="button" class="material-symbols-outlined text-[14px] leading-none" data-remove="${ds}">close</button>
            </span>`;
            inputs += `<input type="hidden" name="dates" value="${ds}">`;
        });
        tags += '</div>';
        el.innerHTML = tags;
        hidden.innerHTML = inputs;

        el.querySelectorAll('[data-remove]').forEach(btn => {
            btn.addEventListener('click', () => {
                selectedDates.delete(btn.dataset.remove);
                renderCalendar();
                updateTags();
            });
        });
    }

    // Time selects
    const startSel = document.getElementById('timeStart');
    const endSel = document.getElementById('timeEnd');
    for (let h = 0; h < 24; h++) {
        startSel.innerHTML += `<option value="${h}" ${h===9?'selected':''}>${String(h).padStart(2,'0')}:00</option>`;
    }
    for (let h = 1; h <= 24; h++) {
        endSel.innerHTML += `<option value="${h}" ${h===18?'selected':''}>${String(h).padStart(2,'0')}:00</option>`;
    }

    document.getElementById('prevMonth').addEventListener('click', () => { calDate.setMonth(calDate.getMonth()-1); renderCalendar(); });
    document.getElementById('nextMonth').addEventListener('click', () => { calDate.setMonth(calDate.getMonth()+1); renderCalendar(); });

    document.getElementById('createForm').addEventListener('submit', function(e) {
        if (selectedDates.size === 0) { e.preventDefault(); alert('날짜를 선택해주세요.'); return; }
        const ts = parseInt(startSel.value), te = parseInt(endSel.value);
        if (te <= ts) { e.preventDefault(); alert('종료 시간은 시작 시간보다 이후여야 합니다.'); }
    });

    renderCalendar();
    updateTags();
});
