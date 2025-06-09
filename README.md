# Care Relay

Servidor de relay en tiempo real basado en Socket.IO.

## Buffers Circulares por Canal

Cada evento recibido se almacena en un buffer circular en memoria de acuerdo con la combinación:

```
<habitacion>.<posicion>.<origen>.<canal>.tap
```

Los eventos incluyen su metadato de origen y se pueden consultar mediante el endpoint:

```
GET /streams/:habitacion/:posicion/:origen/:canal/events
```

Los buffers son volátiles y por defecto almacenan hasta 1080 eventos por canal.
