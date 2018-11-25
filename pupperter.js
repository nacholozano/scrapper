const puppeteer = require('puppeteer');
const config = require('./config.json');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', consoleObj => console.log(consoleObj.text()));
  
  const base = config.urlBase;
  const dia = '2018-11-25';
  const style = fs.readFileSync('./styles/style.css','utf8');

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
    <title>Apuestas</title>
      <style>
      ${style}
      </style>
    </head>
    <body>
      <div class="container">
      <h1>Apuestas</h1>
  `;
  
  page.setViewport({
    width: 1920,
    height: 1080
  });
  
  await page.goto(config.urlFootball + '/' + dia);
  await page.waitFor('.js-event-list-tournament.tournament');
  
  let torneos = JSON.parse(await page.evaluate(a));

  const ts = [];
  
  for (let index = 0; index < torneos.slice(0,5).length; index++) {
    const t = torneos[index];
    await page.goto(base + t.link);  
    
    try{
      const  haytabla = await page.waitForSelector('.standings.js-standings', { timeout: 4000 });
      if (haytabla) {
        const progreso = await page.evaluate(b);
        if (progreso > 30) {
          ts.push(t);
        }
      }
    }catch{}

  }

  const datosPartidos = [];

  for (let iTorneo = 0; iTorneo < ts.length; iTorneo++) {
    const t = ts[iTorneo];
    for (let iPartido = 0; iPartido < t.partidos.length; iPartido++) {
      const partido = t.partidos[iPartido];
      await page.goto(base + partido.link);

      try {
        page.waitForSelector('.standings.js-standings', {timeout: 4000})
        const datos = await page.evaluate(c);
        datosPartidos.push(datos);

        html += datos.html;
      } catch {}
    }
    
  }

  html += `
      </div>
    </body>
    </html>
  `;

  fs.writeFile('./html/' + dia + '.html', html, function(err) {
    if(err) {
        return console.log(err);
    }
    console.log("The file was saved!");
  }); 

  await browser.close();
  
  function a() {
    const torneos = Array.from(document.body.querySelectorAll('.js-event-list-tournament.tournament'));
    return JSON.stringify(torneos.filter(t => {
      return t.querySelector('.js-event-list-tournament-header .tournament__name');
    })
    .map(t => {
      return {
        country: t.querySelector('.tournament__category').textContent.trim(),
        name: t.querySelector('.js-event-list-tournament-header .tournament__name').textContent.trim(),
        link: t.querySelectorAll('.js-event-list-tournament-header .js-link')[1].getAttribute('href'),

        partidos: Array.from(t.querySelectorAll('.cell.cell--event-list.list-event.js-event.js-link.js-event-link')).map(partido => {
          return {
            link: partido.getAttribute('href'),
            hora: partido.querySelector('.u-w48').textContent.trim(),
            texto: Array.from(partido.querySelectorAll('.cell__content.event-team')).reduce((a,s ) => a.textContent.trim() + ' - ' + s.textContent.trim())
          };
        })
      };
    }) );
  }

  function b(){
    const tablas = document.querySelectorAll('.standings.js-standings');
    return tablas.length === 1 ? +(document.querySelector('.progress-bar__elapsed').style.width.replace('%','')) : null;
  }
  
  function c(){

    let html = '';

    const titulo = document.querySelector('.js-event-page-event-name').textContent.trim();
    const migaPan = {
      string: Array.from(document.querySelectorAll('.breadcrumb .js-link'))
        .map(s => s.textContent.trim())  
        .reduce((a, s) => {
          return a + ' -> ' + s;
        }),
      dom: document.querySelector('.breadcrumb').outerHTML
    };

    html += `
      <div class="partido">
        <h2 class="partido-titulo">${titulo}</h2>
        <p class="partido-miga-pan">${migaPan.string}</p>
    `;

    let standings = Array.from(document.querySelectorAll('.cell.cell--standings'));

    const cuotaSelector = document.querySelector('.js-event-page-odds-container');
    const domCuotas = cuotaSelector ? cuotaSelector.outerHTML : '';

    html += `
      <div class="partido-cuotas">
        ${domCuotas}
      </div>
    `;

    const cuotas = {
        dom: domCuotas,
        datos: Array.from(document.querySelectorAll('.odds__group')).map(grupo => {

            const ths = grupo.querySelectorAll('.odds__table th');
            const tds = grupo.querySelectorAll('.odds__table .js-odds-value-decimal');
            const datos = {
                title: grupo.querySelector('.odds__group-title').textContent.trim(),
                cuotas: {}
            };

            ths.forEach((th,i) => {
               datos.cuotas[th.textContent.trim()] = tds[i].textContent.trim();
            });
                
            return datos;
        })
    };
    
    html += `
      <div class="partido-tabla">
    `;
    //<h3>Tabla</h3>

    const length = standings.length / 3;
    const standingsObject = {
        all: standings,
        global: standings.slice(0,length),
        home: standings.slice(length, length*2 ),
        away: standings.slice(length*2, standings.length)
    };

    standings = standings.map((s,standingIndex) => {

        if (standingIndex === 0 || standingIndex === length || standingIndex === length*2 ) {
          html += `
            <div class="partido-tabla-parte">
          `;
        }

        html += `
          <div class="partido-standing">
            ${s.outerHTML}
          </div>
        `;

        if (standingIndex === length-1 || standingIndex === length*2-1 || standingIndex === length*3-1 ) {
          html += `
            </div>
          `;
        }

        const datos = {
            dom: s.outerHTML,
            pos: s.querySelector('.standings__rank .cell__content').textContent.trim(),
            escudo: s.querySelector('.standings__emblem').getAttribute('src'),
            name: s.querySelector('.standings__team-name .js-link').textContent.trim(),
            equipoLink: s.querySelector('.standings__team-name .js-link').getAttribute('href'),
            data: Array.from(s.querySelectorAll('.standings__data span'))
                    .map(s=>s.textContent.trim())
                    .reduce((a,s) => {
               return a + ' - ' + s;
              }
            ),
            puntos: s.querySelector('.standings__points .cell__content').textContent.trim(),
            last5: Array.from(s.querySelectorAll('.standings__last-5 .soficons')).map(a => {
                if (a.classList.contains('soficons-draw')) {
                    return 'D';
                }else if (a.classList.contains('soficons-win')) {
                    return 'W';
                }else if (a.classList.contains('soficons-lose')) {
                    return 'L';
                }
                
            }).reduce((a,s) => a + ' - ' + s )
        };

        if (s.classList.contains('highlight-away-team')) {
            datos.fuera = true;
        }else if (s.classList.contains('highlight-home-team')) {
            datos.casa = true;
        }

        return datos;
    });

    html += `
      </div>
    `;
    
    let equipos = Array.from(document.querySelectorAll('.l__col--1.matches__column')).slice(0,2);
    
    equipos = equipos.map((e,equipoIndex) => {
       const cabecera = e.querySelector('.u-pV12');
       const img = cabecera.querySelector('.img--x38').getAttribute('src');
       const nombre = cabecera.querySelector('.u-fs21').textContent.trim();
        
       let partes = Array.from(e.querySelectorAll('.event-list-table-wrapper.js-event-list-table-wrapper')).slice(2,4);
       /*
       parte 1 global todas las competicones
       parte 2 casa todas las competicones
       parte 3 global liga
       parte 4 casa liga
       */

        html += `
          <div class="partido-partes">
        `;

       partes = partes.map((p,partesIndex) =>{  

          html += `
            <div class="partido-parte">
              ${p.outerHTML}
            </div>
          `;

           let ts = Array.from(p.querySelectorAll('.js-event-list-tournament.tournament')).map(t => {
               const h = t.querySelector('.js-event-list-tournament-header');
               const img2 = h.querySelector('.flags').getAttribute('src');
               const nombre2 = h.querySelector('.tournament__name').textContent.trim();
                
               let partidos = Array.from(t.querySelectorAll('.cell.cell--event-list.js-event.js-link.js-event-status-finished'))
                .map(p => {
                    const fecha = Array.from(p.querySelectorAll('.cell__section.status .cell__content'))
                        .map(c => c.textContent.trim())
                        .reduce((a,s)=> a + ' - ' + s);
                    
                    const partido = Array.from(p.querySelectorAll('.cell__section--main .cell__content.event-team'))
                          .map(e => e.textContent.trim())
                          .map((e,i) => {
                            let newE = e +' ('+ (standingsObject.global.findIndex( item => item.name === e)+1) +'º)';
                            if ( i === 0 ) {    
                                newE = newE +' / ('+ (standingsObject.home.findIndex( item => item.name === e)+1) +'º)';
                            }else {
                                newE = newE +' / ('+ (standingsObject.away.findIndex( item => item.name === e)+1) +'º)';
                            }
                            return newE;
                          })
                          .reduce((a,s) => a + ' - ' + s);

                    const resultado = Array.from(p.querySelectorAll('.event-rounds__final-score .cell__content'))
                        .map(g => g.textContent.trim())
                        .reduce((a,s) => a + ' - ' + s);
                    
                    return {
                       fecha: fecha,
                       partido: partido,
                       resultado: resultado
                    };
                });

               return {
                   img: img2,
                   nombre: nombre2,
                   partidos: partidos,
                   dom: t.outerHTML
               };
           });

           return {
              dom: p.outerHTML,
              img: img,
              nombre: nombre,
              torneos: ts
           };
       });

      html += `
        </div>
      `;

       return partes;
       
    });

    html += `
      </div>
    `;

    return {
        html: html,
        migaPan: migaPan,
        titulo: titulo,
        standings: standingsObject,
        equipos: equipos,
        lenght: length,
        cuotas: cuotas
    };
}
    
})();