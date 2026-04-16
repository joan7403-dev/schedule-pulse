document.addEventListener('DOMContentLoaded', function () {
    const DAYS = ['일','월','화','수','목','금','토'];
    const dataEl = document.getElementById('eventData');
    const eventId = dataEl.dataset.eventId;
    const dates = JSON.parse(dataEl.dataset.dates);
    const timeStart = parseInt(dataEl.dataset.timeStart);
    const timeEnd = parseInt(dataEl.dataset.timeEnd);
    const responses = JSON.parse(dataEl.dataset.responses);

    function pad(n) { return String(n).padStart(2, '0'); }
    function dayName(ds) { return DAYS[new Date(ds + 'T00:00:00').getDay()]; }

    // ★ 개선: "5월 7일 (목)" 형식
    function fullDate(ds) {
        const p = ds.split('-');
        return `${parseInt(p[1])}월 ${parseInt(p[2])}일 (${dayName(ds)})`;
    }

    // 시간 슬롯 생성 (30분 단위)
    const timeSlots = [];
    for (let h = timeStart; h < timeEnd; h++) {
        timeSlots.push(pad(h) + ':00');
        timeSlots.push(pad(h) + ':30');
    }

    // ── Selection Grid ──
    let selectionState = {};
    let isDragging = false;
    let dragMode = null;

    function buildSelectionGrid() {
        const el = document.getElementById('selectionGrid');
        selectionState = {};

        // 헤더
        let html = '<div class="flex border-b border-slate-100 bg-slate-50/50">';
        html += '<div class="w-[72px] min-w-[72px] flex-shrink-0"></div>';
        dates.forEach(d => {
            html += `<div class="flex-1 min-w-[72px] text-center py-3 px-1 text-[11px] font-extrabold text-slate-600 border-l border-slate-100 leading-tight">${fullDate(d)}</div>`;
        });
        html += '</div>';

        // 시간 행
        timeSlots.forEach(slot => {
            const isHour = slot.endsWith(':00');
            html += `<div class="flex ${isHour ? 'border-t-2 border-slate-200' : 'border-t border-slate-50'}">`;
            // ★ 개선: 시간 라벨 진하게
            html += `<div class="w-[72px] min-w-[72px] flex-shrink-0 text-right pr-3 text-[11px] font-bold ${isHour ? 'text-slate-700' : 'text-slate-300'} leading-none h-[28px] flex items-center justify-end">${isHour ? slot : ''}</div>`;
            dates.forEach(d => {
                const key = d + '_' + slot;
                selectionState[key] = false;
                html += `<div class="flex-1 min-w-[72px] h-[28px] border-l border-slate-100 grid-cell cursor-pointer transition-colors hover:bg-primary/10" data-key="${key}"></div>`;
            });
            html += '</div>';
        });

        el.innerHTML = html;

        // 드래그 이벤트
        el.querySelectorAll('.grid-cell').forEach(cell => {
            const startDrag = (e) => {
                e.preventDefault();
                isDragging = true;
                dragMode = selectionState[cell.dataset.key] ? 'deselect' : 'select';
                applyDrag(cell);
            };
            cell.addEventListener('mousedown', startDrag);
            cell.addEventListener('mouseenter', () => { if (isDragging) applyDrag(cell); });
            cell.addEventListener('touchstart', startDrag, { passive: false });
            cell.addEventListener('touchmove', e => {
                if (!isDragging) return;
                e.preventDefault();
                const t = e.touches[0];
                const target = document.elementFromPoint(t.clientX, t.clientY);
                if (target && target.classList.contains('grid-cell')) applyDrag(target);
            }, { passive: false });
        });
    }

    function applyDrag(cell) {
        const key = cell.dataset.key;
        if (!key) return;
        if (dragMode === 'select') { selectionState[key] = true; cell.classList.add('selected'); }
        else { selectionState[key] = false; cell.classList.remove('selected'); }
    }

    document.addEventListener('mouseup', () => { isDragging = false; });
    document.addEventListener('touchend', () => { isDragging = false; });

    // 기존 응답 불러오기
    document.getElementById('participantName').addEventListener('blur', function () {
        const name = this.value.trim();
        if (!name) return;
        const existing = responses.find(r => r.name === name);
        if (existing) {
            Object.keys(selectionState).forEach(k => selectionState[k] = false);
            document.querySelectorAll('#selectionGrid .grid-cell').forEach(c => c.classList.remove('selected'));
            Object.entries(existing.availability).forEach(([k, v]) => {
                if (v && selectionState[k] !== undefined) {
                    selectionState[k] = true;
                    const cell = document.querySelector(`#selectionGrid .grid-cell[data-key="${k}"]`);
                    if (cell) cell.classList.add('selected');
                }
            });
        }
    });

    // 초기화
    document.getElementById('clearSelection').onclick = () => {
        Object.keys(selectionState).forEach(k => selectionState[k] = false);
        document.querySelectorAll('#selectionGrid .grid-cell').forEach(c => c.classList.remove('selected'));
    };

    // 제출
    document.getElementById('submitResponse').onclick = async () => {
        const name = document.getElementById('participantName').value.trim();
        if (!name) { alert('이름을 입력해주세요.'); return; }
        if (!Object.values(selectionState).some(v => v)) { alert('가능한 시간대를 최소 하나 이상 선택해주세요.'); return; }

        const res = await fetch(`/event/${eventId}/respond`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, availability: selectionState })
        });
        if (res.ok) {
            window.location.reload();
        } else {
            const data = await res.json();
            alert(data.error || '오류가 발생했습니다.');
        }
    };

    // ── Results (Heatmap) ──
    function renderResults() {
        const area = document.getElementById('resultsArea');
        if (responses.length === 0) {
            area.innerHTML = '<div class="text-center py-12"><span class="material-symbols-outlined text-4xl text-slate-200 block mb-2">pending</span><p class="text-slate-300 text-sm font-bold">아직 참여한 사람이 없습니다.</p></div>';
            return;
        }

        const total = responses.length;
        let html = '<div class="space-y-6">';

        // 참여자 태그
        html += '<div class="flex flex-wrap items-center gap-2 pt-2"><span class="text-[10px] font-black text-slate-300 uppercase mr-2">Participants:</span>';
        responses.forEach(r => {
            html += `<span class="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1">
                ${esc(r.name)}
                <button class="material-symbols-outlined text-[12px] hover:text-error" data-delete-id="${r.id}">close</button>
            </span>`;
        });
        html += '</div>';

        // 범례
        html += `<div class="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <span>0명</span>
            <div class="flex-1 mx-4 h-1.5 rounded-full bg-gradient-to-r from-slate-100 via-primary/50 to-primary"></div>
            <span>${total}명</span>
        </div>`;

        // 집계
        const counts = {};
        const who = {};
        dates.forEach(d => { timeSlots.forEach(s => { const k = d + '_' + s; counts[k] = 0; who[k] = []; }); });
        responses.forEach(r => {
            Object.entries(r.availability).forEach(([k, v]) => {
                if (v && counts[k] !== undefined) { counts[k]++; who[k].push(r.name); }
            });
        });

        // 히트맵
        html += '<div class="overflow-x-auto rounded-2xl border border-slate-100"><div>';
        html += '<div class="flex border-b border-slate-100 bg-slate-50/50">';
        html += '<div class="w-[72px] min-w-[72px] flex-shrink-0"></div>';
        dates.forEach(d => {
            html += `<div class="flex-1 min-w-[72px] text-center py-3 px-1 text-[11px] font-extrabold text-slate-600 border-l border-slate-100 leading-tight">${fullDate(d)}</div>`;
        });
        html += '</div>';

        timeSlots.forEach(slot => {
            const isHour = slot.endsWith(':00');
            html += `<div class="flex ${isHour ? 'border-t-2 border-slate-200' : 'border-t border-slate-50'}">`;
            html += `<div class="w-[72px] min-w-[72px] flex-shrink-0 text-right pr-3 text-[11px] font-bold ${isHour ? 'text-slate-700' : 'text-slate-300'} leading-none h-[28px] flex items-center justify-end">${isHour ? slot : ''}</div>`;
            dates.forEach(d => {
                const k = d + '_' + slot;
                const cnt = counts[k];
                const ratio = total > 0 ? cnt / total : 0;
                const bg = ratio === 0 ? 'transparent' : `rgba(93, 63, 211, ${0.1 + ratio * 0.9})`;
                const textColor = ratio > 0.5 ? 'text-white' : 'text-slate-500';
                html += `<div class="flex-1 min-w-[72px] h-[28px] border-l border-slate-50 text-[10px] font-black flex items-center justify-center ${textColor} heatmap-cell" style="background:${bg}" title="${who[k].join(', ') || '없음'} (${cnt}/${total}명)">${cnt > 0 ? cnt : ''}</div>`;
            });
            html += '</div>';
        });
        html += '</div></div></div>';
        area.innerHTML = html;

        // 삭제 핸들러
        area.querySelectorAll('[data-delete-id]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.deleteId;
                const tag = btn.closest('span');
                const name = tag ? tag.textContent.trim() : '';
                if (!confirm(`${name}님의 응답을 삭제하시겠습니까?`)) return;

                const res = await fetch(`/event/${eventId}/delete-response`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ response_id: id })
                });
                if (res.ok) window.location.reload();
            });
        });
    }

    function esc(s) {
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    // Init
    buildSelectionGrid();
    renderResults();
});
