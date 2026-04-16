import sqlite3
import uuid
import json
import os
from flask import Flask, render_template, request, redirect, url_for, jsonify, g

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'schedule-pulse-secret-key')

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'schedule.db')


# ── Database ──────────────────────────────────────────────

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute('PRAGMA journal_mode=WAL')
    return g.db


@app.teardown_appcontext
def close_db(exception):
    db = g.pop('db', None)
    if db is not None:
        db.close()


def init_db():
    db = sqlite3.connect(DB_PATH)
    db.executescript('''
        CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            host_name TEXT NOT NULL,
            dates TEXT NOT NULL,
            time_start INTEGER NOT NULL DEFAULT 9,
            time_end INTEGER NOT NULL DEFAULT 18,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS responses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id TEXT NOT NULL,
            participant_name TEXT NOT NULL,
            availability TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
            UNIQUE(event_id, participant_name)
        );
    ''')
    db.commit()
    db.close()


# ── Jinja2 Filters ───────────────────────────────────────

@app.template_filter('pad')
def pad_filter(n):
    return str(n).zfill(2)


# ── Routes ────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/create', methods=['POST'])
def create_event():
    title = request.form.get('title', '').strip()
    host_name = request.form.get('host_name', '').strip()
    description = request.form.get('description', '').strip()
    dates = request.form.getlist('dates')
    time_start = int(request.form.get('time_start', 9))
    time_end = int(request.form.get('time_end', 18))

    if not title or not host_name or not dates:
        return redirect(url_for('index'))
    if time_end <= time_start:
        return redirect(url_for('index'))

    event_id = uuid.uuid4().hex[:8]
    dates_json = json.dumps(sorted(dates))

    db = get_db()
    db.execute(
        'INSERT INTO events (id, title, description, host_name, dates, time_start, time_end) VALUES (?, ?, ?, ?, ?, ?, ?)',
        (event_id, title, description, host_name, dates_json, time_start, time_end)
    )
    db.commit()

    return redirect(url_for('event_created', event_id=event_id))


@app.route('/event/<event_id>/created')
def event_created(event_id):
    db = get_db()
    event = db.execute('SELECT * FROM events WHERE id = ?', (event_id,)).fetchone()
    if not event:
        return render_template('404.html'), 404
    return render_template('created.html', event=event, dates=json.loads(event['dates']))


@app.route('/event/<event_id>')
def event_page(event_id):
    db = get_db()
    event = db.execute('SELECT * FROM events WHERE id = ?', (event_id,)).fetchone()
    if not event:
        return render_template('404.html'), 404

    responses = db.execute(
        'SELECT * FROM responses WHERE event_id = ? ORDER BY created_at', (event_id,)
    ).fetchall()

    dates = json.loads(event['dates'])
    parsed = []
    for r in responses:
        parsed.append({
            'id': r['id'],
            'name': r['participant_name'],
            'availability': json.loads(r['availability'])
        })

    return render_template(
        'event.html',
        event=event,
        dates=dates,
        responses=parsed,
        responses_json=json.dumps(parsed)
    )


@app.route('/event/<event_id>/respond', methods=['POST'])
def respond(event_id):
    db = get_db()
    event = db.execute('SELECT * FROM events WHERE id = ?', (event_id,)).fetchone()
    if not event:
        return jsonify({'error': 'Event not found'}), 404

    data = request.get_json()
    name = data.get('name', '').strip()
    availability = data.get('availability', {})

    if not name:
        return jsonify({'error': '이름을 입력해주세요.'}), 400

    availability_json = json.dumps(availability)

    existing = db.execute(
        'SELECT id FROM responses WHERE event_id = ? AND participant_name = ?',
        (event_id, name)
    ).fetchone()

    if existing:
        db.execute(
            'UPDATE responses SET availability = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            (availability_json, existing['id'])
        )
    else:
        db.execute(
            'INSERT INTO responses (event_id, participant_name, availability) VALUES (?, ?, ?)',
            (event_id, name, availability_json)
        )

    db.commit()
    return jsonify({'success': True})


@app.route('/event/<event_id>/delete-response', methods=['POST'])
def delete_response(event_id):
    data = request.get_json()
    response_id = data.get('response_id')

    db = get_db()
    db.execute('DELETE FROM responses WHERE id = ? AND event_id = ?', (response_id, event_id))
    db.commit()
    return jsonify({'success': True})


# ── Entry Point ───────────────────────────────────────────

if __name__ == '__main__':
    init_db()
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
