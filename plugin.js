/**
 * {
 * "name": "AI Control",
 * "version": "1.0.0",
 * "description": "Control Lampa via WebSocket AI"
 * }
 */
(function () {
    let socket;
    let serverIp = '192.168.1.66'; 

    function connect() {
        socket = new WebSocket(`ws://${serverIp}:8000`);

        socket.onopen = () => {
            console.log('Lampa-AI: Connected to server');
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log('Lampa-AI: Command received', data);

            if (data.method === 'search') {
                Lampa.Input.search(data.query);
                setTimeout(() => {
                    let items = Lampa.Activity.active().items || [];
                    let res = items.slice(0, 5).map(i => ({id: i.id, title: i.name || i.title}));
                    socket.send(JSON.stringify(res));
                }, 1500);
            }

            if (data.method === 'open') {
                Lampa.Activity.push({
                    url: '',
                    component: 'full',
                    card: { id: data.id, method: data.type || 'movie' },
                    source: 'tmdb'
                });
            }

            if (data.method === 'play') {
                let btn = $('.view--torrent, .button--torrent').first();
                if (btn.length) btn.click();
            }
        };

        socket.onclose = () => {
            console.log('Lampa-AI: Connection lost. Reconnecting...');
            setTimeout(connect, 5000);
        };
    }

    Lampa.Listener.follow('app', (e) => {
        if (e.type === 'ready') connect();
    });
})();
