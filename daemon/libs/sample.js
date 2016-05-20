var
    redis         = require('redis'),
    express       = require('express'),
    EventEmitter  = require('events'),

    subscriptions = {},
    app           = express(),
    maxTimeout    = 60000, // one minute, but could be longer

    keyspaceEvents,
    subClient,
    client;

// `subClient` connection is only used for subscribing to events. `client` handles the normal Redis commands
subClient = redis.createClient({db: 11});
client = subClient.duplicate();
// Node's internal event emitter
keyspaceEvents = new EventEmitter();
// This defaults to 10, 0 sets an unlimited amount of listeners. You might want something more sane.
keyspaceEvents.setMaxListeners(0);

// Helper function to consistently build the prefix as sent by the Redis keyspace notification. The keyspace notification includes the db number so we're using `subClient.selected_db`
function eventPrefix() {
    return '__keyspace@'+subClient.selected_db+'__:';
}

//For keyspace notifications, a ':' seperates the prefix from the key. To get just the key, we'll lop off anything before the first ':'
function keyFromChannel(channel) {
    var
        parts = channel.split(eventPrefix());

    return parts.slice(1).join(':');
}

//We're tracking the internal "subscriptions" by an object. Each subscription is represented by a key in `subscription` with the value representing the number of subscribers. So if you've subscribed to the Redis key 'foo' five times, then the object would look like `{ foo : 5 }`. When unsubscribing, if the value is one and we're unsubscribe (e.g. no subscribers) then we remove it from the `subscriptions` object, otherwise we just decrement.
function evSubscribe(key) {
    if (!subscriptions[key]) {
        subClient.subscribe([eventPrefix(),key].join(''));
        subscriptions[key] = 0;
    }
    subscriptions[key] += 1;
}
function evUnsubscribe(key) {
    if (subscriptions[key] === 1) {
        subClient.unsubscribe([eventPrefix(),key].join(''));
        delete subscriptions[key];
    } else {
        subscriptions[key] -= 1;
    }
}

// `req` is the express request object, `msUntilSend` is the number of milliseconds until the event is responded to and `cb` is our callback. With the callback, you get the value of the `key` (or an error). We're doing one trick here: if the `msUntilSend` argument is 0, then we bypass any of the subscription stuff and respond back immediately - this allows us to have one consistent function for both the inital (short) poll and long polling.
// With long polling there is a good chance that you're going to abort your connection while a HTTP request is in process. We have to control for that with `req.on('close'...` which will remove our listener and decrement the internal subscription object.
function untilEvent(req,msUntilSend,cb) {
    var
        key = req.params.key,
        respond,
        changeTimeout;

    respond = function() {
        keyspaceEvents.removeListener(key,respond);
        if (msUntilSend > 0) {
            clearTimeout(changeTimeout);
            evUnsubscribe(key);
        }

        client.get(key,function(err,value) {
            if (err) { cb(err); } else { cb(err,value); }
        });
    };

    req.on('close', function() {
        keyspaceEvents.removeListener(key,respond);
        evUnsubscribe(key);
    });

    if (msUntilSend > 0) {
        evSubscribe(key);
        keyspaceEvents.once(key,respond);
        changeTimeout = setTimeout(respond,msUntilSend);
    } else {
        respond();
    }
}

// A closure that wraps `untilEvent` in Express's middleware format. The closure just allows us to setup a single function with the same headers and response logic for both polling and long polling
function poll(msUntilSend) {
    return function(req,res,next) {
        untilEvent(req, msUntilSend, function(err,value) {
            if (err) { next(err); } else {
                res
                .header('Cache-Control', 'private, no-cache, no-store, must-revalidate')
                .header('Expires', '-1')
                .header('Pragma', 'no-cache')
                .status(200)
                .send(value);
            }
        });
    };
}

//We're essentially proxying the node_redis subscription to our `keyspaceEvents` event emitter but making the the event more useful - instead emitting a generic message, we're sending out the key. If there is no subscriptions, then the event emitter is shouting into the void.
subClient.on('message', function (channel, message) {
    var
        key = keyFromChannel(channel);
    
    keyspaceEvents.emit(key,message);
});


app.get('/long-poll/:key', poll(maxTimeout));
app.get('/poll/:key', poll(0));
app.use(express.static('static'));
app.listen(2600,function() {
    console.log('long poll listening');
});