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

    // Only render if tabrow is empty (not on detail page with static tabs)
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
        // use sport id (si) as tab/card identifier
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
    // clear existing static cards
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
                const suspendedHtml = ev.go === false ? `<div class="odds-overlay suspended">Suspended</div>` : '';
                const match = document.createElement('div');
                match.className = 'top-matches';
                match.innerHTML = `
                   <div class="info-div">
                        <div class="match-time">
                            <span class="mtch-date">${t.date}</span>,
                            <span class="mtch-time">${t.time}</span>
                        </div>
                        <div class="team-wpr">
                            <a href="./sportsDetail.html?eid=${ev.eid}" class="teams">
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

// Event Listeners
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
});

socket.on('connect', () => {
    console.log('Socket connected');
    socket.emit('sport', (callback) => {
        console.log('Sport List:', callback);
        const sports = callback && callback.data ? callback.data : [];
        renderSportTabs(sports);

        // request events for all sport ids
        const siList = sports.map(s => s.si).filter(Boolean).join(',');
        socket.emit('event', { type: 'list', data: siList }, (evCallback) => {
            console.log('Event List:', evCallback);
            const eventsBySi = evCallback && evCallback.data ? evCallback.data : {};
            
            // ✅ EXTRACT ALL eid VALUES
            const allEventIds = [];
            Object.values(eventsBySi).forEach(events => {
                events.forEach(event => {
                    if (event.eid) {  // Use eid instead of id
                        allEventIds.push(event.eid);
                    }
                });
            });
            
            console.log('All Event IDs (eid):', allEventIds);
            console.log('Total Events:', allEventIds.length);
            
            // ✅ CALL MARKET API FOR EACH eid
            //  allEventIds.forEach(eventId => {
                socket.emit('market', { type: "list", data: "34945175" }, (marketCallback) => {
                    console.log("Markets" ,marketCallback);
                });
            // });
            
              console.log(`Fetching markets for: ${eventName} (ID: ${eventId})`);
            renderSportCards(sports, eventsBySi);
        });
    });
});