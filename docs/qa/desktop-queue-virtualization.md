# Cola de escritorio: arrastre y renderizado por lotes

El adaptador anterior de `react-native-draggable-flatlist` dibujaba todas las filas mediante `ScrollView` y `data.map`. Ignoraba los parámetros de QueueSheet de Android (`initialNumToRender=8`, `maxToRenderPerBatch=8`, `windowSize=7`, `getItemLayout`, umbral y velocidad de autoscroll). Además llamaba a `onDragEnd` en cada cambio de posición durante el arrastre.

El adaptador de PC ahora usa FlatList y entrega esos parámetros a la lista virtualizada. Toda la cola sigue disponible, igual que en Android; lo que se monta y renderiza se limita a la ventana visible y sus lotes. No se introduce un límite de canciones ni una cola alternativa.

El arrastre conserva su estado en la lista, mediante captura del puntero, para que no dependa de que la fila de origen siga montada. Cerca de los bordes superior/inferior, un ciclo de animación desplaza el contenedor y actualiza el destino. Solo se confirma el orden una vez al soltar. Escape, pérdida de foco, cancelación del puntero o sustitución de la cola cancelan el movimiento. Se elimina el ciclo de animación al cancelar, soltar o desmontar.

Se mantienen cabeceras, pies, filas vacías y los callbacks usados por otras pantallas. El cambio del componente compartido nativo QueueSheet se limita a identificar el tirador para la prueba; Android conserva su lista original.

Verificación en Electron: `.tmp/desktop-sheets/1793310437620/report.json`, cinco pruebas correctas:

- Cola real de 600 entradas: primer lote de ocho, menos de 100 filas montadas en la ventana de prueba, scroll hasta un lote lejano y hasta la última entrada.
- Pulsación mantenida y movimientos de ratón reales: autoscroll en ambos sentidos, sin guardar movimientos intermedios; una confirmación al soltar.
- Cancelación con Escape y sustitución de cola durante el arrastre sin guardar el movimiento pendiente.
- Eliminar/deshacer/reordenar/reproducir y aleatorio al final de la cola.
- Reordenar/guardar orden de biblioteca, navegación e Inicio.

Comprobación de tipos y compilación correctas.

## Scroll durante la apertura

Se reprodujo una ventana negra permanente al desplazar la cola desde el primer lote, antes de terminar las mediciones iniciales de VirtualizedList. La prueba anterior esperaba a que la cola estuviera estable y solo comprobaba las filas montadas, por lo que no cubría este fallo. El nuevo caso empieza con el snapshot vacío y desplaza la lista desde MutationObserver al aparecer las primeras filas; comprueba la intersección real de las filas con el área visible. Falló antes del arreglo a zoom 70 %, con ocho filas montadas y scrollTop 5760.

Para las filas de altura fija de QueueSheet, PC usa ahora una ventana calculada a partir del scroll y del tamaño reales del contenedor del navegador. Las filas visibles se actualizan dentro del evento de scroll y el margen de filas adicionales se monta por lotes. No depende de que haya terminado la medición inicial de la lista nativa. Las listas con cabecera, pie o altura variable mantienen FlatList.

Resultado: `.tmp/desktop-sheets/1793310936379/report.json`, seis pruebas correctas. El caso de apertura usa 700 entradas, scroll inmediato, saltos hacia delante/atrás y zoom 70/100/130 %. La cola de 600 entradas conserva el primer lote de ocho, ventana acotada, autoscroll, una confirmación al soltar y cancelación con Escape o sustitución de cola. Comprobación de tipos y compilación correctas.

Comando: `npm run test:sheets --workspace=@mmplayer/desktop -- --filter 'QUEUE-VIRTUAL:|ALL: eliminar deshacer reordenar|Reordenar y guardar'`.
