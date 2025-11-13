// helper to make safe ids
function slug(name) {
    return String(name || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
}

const socket = io('https://preprodvicsdk.bettech.live/', {
    reconnectionAttempts: 1000,
    transports: ["websocket"]
});

function formatStart(iso) {
    if (!iso) return { date: '', time: '' };
    const d = new Date(iso);
    return {
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    };
}

function renderSportTabs(sports) {
    const tabrow = document.querySelector('.sports-tabrow');
    if (!tabrow) return;
    if (tabrow.querySelector('.sports-tab-item')) {
        console.log('Static tabs found, skipping dynamic render');
        return;
    }
    tabrow.innerHTML = '';
    sports.forEach((s, idx) => {
        const btn = document.createElement('button');
        btn.setAttribute('role', 'tab');
        btn.className = 'sports-tab-item' + (idx === 0 ? ' active' : '');
        btn.setAttribute('aria-selected', idx === 0 ? 'true' : 'false');
        btn.setAttribute('aria-controls', String(s.si));
        btn.id = 'tab-' + String(s.si);
        btn.dataset.tab = String(s.si);
        btn.innerHTML = `<span class="sports-tabttl-wrap"><span class="sports-tabttl">${(s.na || '').toUpperCase()}</span></span>`;
        tabrow.appendChild(btn);
    });
}

function renderSportCards(sports, eventsBySi) {
    const content = document.querySelector('.sports-tab-content');
    if (!content) return;
    content.innerHTML = '';
    sports.forEach((s, idx) => {
        const si = String(s.si);
        const card = document.createElement('div');
        card.className = 'sports-card';
        card.id = si;
        card.style.display = idx === 0 ? 'block' : 'none';

        const header = document.createElement('div');
        header.className = 'sports-event-lsection';
        header.innerHTML = `
            <div class="event-lhdr">
                <div class="event-lttl">
                    <span class="sct-val">${s.na}</span>
                </div>
            </div>
            <div class="events-listing">
                <div class="match-list schedule">
                    <div class="match-list-hdr">
                        <div class="match-list-hdr-ttl"><div class="label">Schedule</div></div>
                        <div class="match-list-hdr-matched"></div>
                        <div class="match-listhdr-odds-wrp">
                            <div class="match-list-hdr-odds odd-1"><div class="label">1</div></div>
                            <div class="match-list-hdr-odds odd-x"><div class="label">X</div></div>
                            <div class="match-list-hdr-odds odd-2"><div class="label">2</div></div>
                        </div>
                    </div>
                    <div class="match-list-body"></div>
                </div>
            </div>
        `;

        const body = header.querySelector('.match-list-body');
        const events = eventsBySi && eventsBySi[si] ? eventsBySi[si] : [];
        
        if (!events || events.length === 0) {
            const noEvt = document.createElement('div');
            noEvt.className = 'top-matches';
            noEvt.style.padding = '15px';
            noEvt.innerHTML = `<div class="team-wpr"><div class="team-name" style="color:#fff">No events</div></div>`;
            body.appendChild(noEvt);
        } else {
            events.forEach(ev => {
                const t = formatStart(ev.st);
                const match = document.createElement('div');
                match.className = 'top-matches';
                match.innerHTML = `
                   <div class="info-div">
                        <div class="match-time">
                            <span class="mtch-date">${t.date}</span>,
                            <span class="mtch-time">${t.time}</span>
                        </div>
                        <div class="team-wpr">
                            <a href="./sportsDetail.html?eid=${ev.eid}" class="teams" data-eid="${ev.eid}">
                                <div class="team-name">${ev.na}</div>
                            </a>
                            ${ev.ip ? `<div class="inplay-txt">In-Play</div>` : ''}
                        </div>
                    </div>
                    <div class="matches-odds-wrp">
                        <div class="matches-odds-card">
                            <div class="odds-count-wrp">
                                <div class="top-matches-count count-1">
                                    <div class="match-odd back-bg"><div class="odd-val">--</div></div>
                                    <div class="match-odd lay-bg"><div class="odd-val">--</div></div>
                                </div>
                                <div class="top-matches-count count-x">
                                    <div class="match-odd back-bg"><div class="odd-val">--</div></div>
                                    <div class="match-odd lay-bg"><div class="odd-val">--</div></div>
                                </div>
                                <div class="top-matches-count count-2">
                                    <div class="match-odd back-bg"><div class="odd-val">--</div></div>
                                    <div class="match-odd lay-bg"><div class="odd-val">--</div></div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                body.appendChild(match);
            });
        }
        card.appendChild(header);
        content.appendChild(card);
    });
}

function navigateToSportsDetail(eventId, eventName, marketData) {
    const eventData = {
        eventId: eventId,
        eventName: eventName,
        marketData: marketData,
        timestamp: new Date().getTime()
    };
    
    sessionStorage.setItem('currentEventData', JSON.stringify(eventData));
    window.location.href = `./sportsDetail.html?eid=${eventId}`;
}

// ✅ CHECK IF WE'RE ON MAIN PAGE BEFORE RUNNING SPORTS LOGIC
if (!window.location.pathname.includes('sportsDetail.html')) {
    document.addEventListener('DOMContentLoaded', () => {
        const tabs = document.querySelector('.sports-tabrow');
        tabs && tabs.addEventListener('click', e => {
            const tab = e.target.closest('.sports-tab-item');
            if (!tab) return;
            const selectedTab = tab.dataset.tab;
            document.querySelectorAll('.sports-tab-item').forEach(item => item.classList.toggle('active', item === tab));
            document.querySelectorAll('.sports-card').forEach(card => {
                card.style.display = (card.id === selectedTab) ? 'block' : 'none';
            });
        });

        document.addEventListener('click', function(e) {
            const teamLink = e.target.closest('.teams');
            if (teamLink) {
                e.preventDefault();
                const eventId = teamLink.getAttribute('data-eid');
                const eventName = teamLink.querySelector('.team-name').textContent;
                
                console.log(`Match clicked: ${eventName} (ID: ${eventId})`);
                
                socket.emit('market', { type: "list", data: eventId }, (marketCallback) => {
                    console.log(`Market data for event ${eventId}:`, marketCallback);
                    navigateToSportsDetail(eventId, eventName, marketCallback);
                });
            }
        });
    });

    socket.on('connect', () => {
        console.log('Socket connected - MAIN PAGE');
        socket.emit('sport', (callback) => {
            console.log('Sport List:', callback);
            const sports = callback && callback.data ? callback.data : [];
            renderSportTabs(sports);

            const siList = sports.map(s => s.si).filter(Boolean).join(',');
            socket.emit('event', { type: 'list', data: siList }, (evCallback) => {
                console.log('Event List:', evCallback);
                const eventsBySi = evCallback && evCallback.data ? evCallback.data : {};
                renderSportCards(sports, eventsBySi);
            });
        });
    });
}