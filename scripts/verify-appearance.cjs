// Isolated renderer/Chromium acceptance. No backend, provider, credentials or pairing.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const { fixtureConfigSource } = require('./fixtures/app-defaults.cjs');
const output = path.join(root, 'outputs/appearance');
app.setPath('userData', path.join(output, 'runtime'));
// Cleanup must not quit before the outer error handler can report a failed assertion.
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  const { createServer } = await import('vite');
  const fixture = `
    localStorage.removeItem('chat-on-steroids.sidebar-order');
    localStorage.removeItem('cos.ui.language');
    ${fixtureConfigSource()}
    const config = fixtureConfig({
      roots: [{name:'demo',path:'C:/demo'}], readOnly:true,
      capabilities: {browse:true,search:true,read:true,metadata:true,create:false,edit:false,move:false,deleteFile:false,command:false,screen:false,control:false,clipboardRead:false,clipboardWrite:false},
      tunnel: {kind:'openai',tunnelId:'',desktopTunnelId:'',binaryPath:''},
      ui: {minimizeToTray:true,autoConnect:false,privacyScreenshots:false,theme:'dark',tabsToKeepOpen:7,finishAction:'notify'},
      sessions: {record:true,retainDays:30,advisoryTokens:300000,limitTokens:400000}, compaction:{auto:true,autoTokens:300000},
      multiAgent:{enabled:false,maxWorkers:2,allowUnattributedCalls:false,recoverAgentTabs:false},
      goal:{enabled:false,model:'fixture',reasoning:'default',prompt:'Fixture'}
    });
    const state = {config,hasApiKey:false,hasGoalKey:false,resolvedBinary:null,bundledTunnelVersion:null,
      status:{state:'disconnected',detail:'',publicUrl:null,localUrl:null,handshakeAt:null,lastRequestAt:null,lastToolCallAt:null,health:null,surfaces:[]},
      bridge:{running:false,port:0,paired:false,present:false,lastSeenAt:null,extensionVersion:null},
      update:{current:'2.0.9',latest:null,stage:'idle',error:null,checkedAt:null}};
    const project = {id:'demo-project',name:'VideoClipper',path:'C:/demo',createdAt:1};
    const rows = Array.from({length:22},(_,i)=>({id:'task-'+i,title:'Project chat '+(i+1),projectId:project.id,
      conversationId:'chat-'+i,chatIds:['chat-'+i],startedAt:1,updatedAt:100-i,endedAt:2,events:0,userMessages:0,
      toolCalls:0,lastToolCallAt:null,processExitNonzero:0,toolRejected:0,toolInternalErrors:0,errors:0,
      estimatedTokens:0,contextTokens:0,lastHandoffId:null,lastHandoffAt:null,lastTurnOutcome:null,activeTurnId:null,agents:[],origin:null}));
    const ok=data=>Promise.resolve({ok:true,data});
    window.api = new Proxy({ getState:()=>ok(state),getLog:()=>ok([]),
      listProjects:()=>ok([project]),listSessions:()=>ok({sessions:rows,total:22,nextCursor:null,activeId:null,pressure:[],blocked:[]}),
      getSwarm:()=>ok({running:false,runId:null,agents:[],maxWorkers:2,pendingReports:0}),
      getChatModels:()=>ok({state:'unknown',models:[]}),
      onStateChanged:callback=>{window.pushState=()=>callback(structuredClone(state));},
      saveSettings:async patch=>{if(window.rejectSave) {window.rejectSave=false;return {ok:false,error:'Fixture save rejected'};} window.savedPatches=(window.savedPatches??[]).concat([structuredClone(patch)]); if(window.holdSave) await new Promise(resolve=>window.releaseSave=resolve); state.config={...state.config,...patch};return {ok:true,data:structuredClone(state)}},
      addSetupProfile:name=>{
        const previous={id:config.tunnel.profileId??'default',name:config.tunnel.profileName??'Default',tunnelId:'',desktopTunnelId:'',pluginsTunnelId:''};
        config.setupProfiles=[...(config.setupProfiles??[]),previous];
        config.tunnel={...config.tunnel,profileId:'fixture-profile',profileName:name,profileEpoch:(config.tunnel.profileEpoch??0)+1};
        return ok(state);
      },
      removeSetupProfile:id=>{config.setupProfiles=config.setupProfiles.filter(p=>p.id!==id);return ok(state)}
    },{get:(target,key)=>key in target?target[key]:()=>ok(null)});
    await import('/main.ts');
    const still=document.createElement('style'); still.id='fixture-motion-freeze'; still.textContent='*,*::before,*::after{animation:none!important;transition:none!important}'; document.head.append(still);
    window.fixtureState=state; window.fixtureReady=true;
  `;
  const server = await createServer({ configFile:false, root:path.join(root,'src/renderer'),
    server:{host:'127.0.0.1',port:0}, plugins:[{ name:'appearance-fixture', configureServer(vite) {
      vite.middlewares.use('/fixture.html', async (_request,response) => {
        const source = fs.readFileSync(path.join(root,'src/renderer/index.html'),'utf8')
          .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace('</body>', '<script type="module">'+fixture+'</script></body>');
        response.setHeader('Content-Type','text/html'); response.end(await vite.transformIndexHtml('/fixture.html',source));
      });
    }}] });
  let win;
  try {
    await server.listen(); fs.mkdirSync(output,{recursive:true});
    win = new BrowserWindow({show:false,width:1100,height:900,webPreferences:{sandbox:true,backgroundThrottling:false}});
    await win.loadURL(server.resolvedUrls.local[0]+'fixture.html');
    win.webContents.setZoomFactor(1);
    const js = code=>win.webContents.executeJavaScript(code);
    const verifyPopoverPalette = async () => {
      const mismatch = await js(`(() => {
        const sidebar = getComputedStyle(document.querySelector('.sidebar'));
        const popup = getComputedStyle(document.getElementById('connectionPopover'));
        return ['background', 'backdrop-filter', '--ink', '--soft', '--faint', '--edge', '--hover', '--accent', '--accent-edge']
          .filter(key => sidebar.getPropertyValue(key) !== popup.getPropertyValue(key));
      })()`);
      assert.deepEqual(mismatch, [], 'Connection popover must share the live sidebar palette');
    };
    const screenshot = async name => {
      await verifyPopoverPalette();
      await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});
      await new Promise(r=>setTimeout(r,200));
      fs.writeFileSync(path.join(output,name),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
    };
    for(let i=0;i<100 && !(await js('!!window.fixtureReady && document.querySelectorAll(".project-group > .sess").length === 5'));i++) await new Promise(r=>setTimeout(r,25));
    assert.equal(await js('!!window.fixtureReady'),true);
    const change = async (id,value) => {
      await js(`(() => {const input=document.getElementById(${JSON.stringify(id)});input.value=${JSON.stringify(value)};input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
      await js('new Promise(r=>setTimeout(r,40))');
    };
    // These are actual, visible app regions, not preset thumbnails. In addition to the editable
    // palette, each immersive skin must change the rendered geometry/ornament on every surface.
    // Comparing a style against Classic in the SAME theme prevents light/dark alone from passing.
    const skinSurfaces = {
      background:['.app'],
      chrome:['.app-topbar','.chat-head'],
      sidebar:['.sidebar'],
      chat:['.card.is-session','#chatBody','.welcome-mark'],
      composer:['.composer','.send-button'],
      navigation:['.sidebar .new-chat','.sidebar-primary-link','.sess','.sidebar-session-label','.sidebar-brand .mark']
    };
    const skinSnapshot = () => js(`(() => {
      const regions = ${JSON.stringify(skinSurfaces)};
      const appearance = element => {
        const style = getComputedStyle(element);
        const decoration = value => [
          value.backgroundImage, value.boxShadow, value.borderRadius,
          value.borderTopStyle, value.borderTopWidth, value.backdropFilter,
          value.filter, value.textShadow, value.outlineStyle, value.outlineWidth,
          value.clipPath, value.maskImage, value.borderImageSource,
          value.fontFamily, value.letterSpacing, value.fontWeight, value.textTransform
        ];
        const pseudo = name => {
          const value = getComputedStyle(element, name);
          return [value.content, value.backgroundImage, value.backgroundColor,
            value.boxShadow, value.borderRadius, value.opacity, value.transform];
        };
        return {
          visible: element.getClientRects().length > 0 && style.visibility !== 'hidden',
          colors:[style.backgroundColor,style.color,style.borderTopColor],
          decoration:[...decoration(style),...pseudo('::before'),...pseudo('::after')]
        };
      };
      return {
        style:document.documentElement.dataset.appearanceStyle,
        theme:document.documentElement.dataset.theme,
        regions:Object.fromEntries(Object.entries(regions).map(([name, selectors]) =>
          [name, selectors.map(selector => {
            const element = document.querySelector(selector);
            return element ? appearance(element) : null;
          })]))
      };
    })()`);
    // Sample the real Settings cards, not just preset thumbnails. Keeping this probe in the
    // production renderer catches specificity mistakes where a new skin only paints its picker.
    const deepSettingsSnapshot = () => js(`(() => {
      const panel=document.getElementById('appearancePanel');
      const card=panel.querySelector('.appearance-settings-card');
      const preview=panel.querySelector('.appearance-preview');
      const style=element=>{
        const css=getComputedStyle(element);
        const rect=element.getBoundingClientRect();
        return {background:css.backgroundImage,fill:css.backgroundColor,border:css.borderTopColor,
          radius:css.borderTopLeftRadius,shadow:css.boxShadow,width:rect.width};
      };
      return {card:style(card),preview:style(preview),
        overflow:panel.scrollWidth-panel.clientWidth,
        cardControls:[...card.querySelectorAll('input,select,button')].filter(node=>!node.disabled).length};
    })()`);
    // These fixtures expose hidden production surfaces without a backend or synthetic CSS:
    // focus a real composer textarea, select a sidebar button, and show an existing dock status.
    const deepChatSnapshot = () => js(`(() => {
      const composer=document.getElementById('composer'),input=document.getElementById('chatInput');
      const nav=document.getElementById('sidebarPlugins'),dock=document.getElementById('composerDock');
      const status=document.getElementById('backgroundExecStatus');
      const style=element=>{
        const css=getComputedStyle(element);
        const rect=element.getBoundingClientRect();
        return {background:css.backgroundImage,fill:css.backgroundColor,
          shadow:css.boxShadow,border:css.borderTopColor,radius:css.borderTopLeftRadius,
          outline:css.outlineStyle,filter:css.filter,animation:css.animationName,
          transition:css.transitionProperty,width:rect.width,height:rect.height};
      };
      const idleComposer=style(composer);
      input.focus();
      const focusedComposer=style(composer);
      const focusedPseudo=getComputedStyle(composer,'::before');
      const focusArt={content:focusedPseudo.content,background:focusedPseudo.backgroundImage,
        height:focusedPseudo.height,visibility:focusedPseudo.visibility};
      input.blur();
      const idleNav=style(nav);
      const alreadySelected=nav.classList.contains('is-sel');
      nav.classList.add('is-sel');
      const selectedNav=style(nav);
      if(!alreadySelected)nav.classList.remove('is-sel');
      const originallyHidden=status.hidden;
      status.hidden=false;
      const shownDock=style(dock);
      const visibleDock=getComputedStyle(dock).display!=='none' &&
        Number(getComputedStyle(dock).opacity)>.9 && shownDock.width>0 && shownDock.height>0;
      status.hidden=originallyHidden;
      const app=document.querySelector('.app');
      const fullscreenEffects=['.app','.sidebar','.card.is-session','#chatBody','.chat-head']
        .map(selector=>({selector,filter:getComputedStyle(document.querySelector(selector)).filter,
          willChange:getComputedStyle(document.querySelector(selector)).willChange}));
      return {idleComposer,focusedComposer,focusArt,idleNav,selectedNav,
        shownDock,visibleDock,fullscreenEffects,appWidth:app.clientWidth,appScroll:app.scrollWidth};
    })()`);
    // Render short synthetic conversation DOM with the same production classes used by chat.ts.
    // This lives only in the isolated fixture, never in app data or any user conversation.
    const richScene = () => js(`(() => {
      const timeline=document.getElementById('timeline');
      const empty=document.getElementById('timelineEmpty');
      const wasHidden=empty.hidden; empty.hidden=true;
      const fixture=document.createElement('section');fixture.id='appearance-rich-fixture';
      const user=document.createElement('div');user.className='said is-user';
      const userBody=document.createElement('div');userBody.className='msg user-message-text';
      userBody.textContent='Check the build and report accessibility findings.';
      user.append(userBody);
      const assistant=document.createElement('article');assistant.className='said';
      const rich=document.createElement('div');rich.className='msg rich';
      const heading=document.createElement('h2');heading.textContent='Build and accessibility report';
      const summary=document.createElement('p');summary.textContent='The check finished using local fixture data only.';
      const quote=document.createElement('blockquote');quote.textContent='Keep the readable surface and keyboard focus visible.';
      const pre=document.createElement('pre'),code=document.createElement('code');
      code.textContent='npm run build -- --fixture-only\\n'+('console.log("safe local output"); '.repeat(12));
      pre.append(code);rich.append(heading,summary,quote,pre);assistant.append(rich);
      const details=document.createElement('details');details.className='tool-group';details.open=true;
      const toolLabel=document.createElement('summary');toolLabel.textContent='Fixture tool output';
      const toolBody=document.createElement('div');toolBody.className='tool-group-body';
      toolBody.textContent='Local check passed';details.append(toolLabel,toolBody);
      fixture.append(user,assistant,details);timeline.append(fixture);
      const paint=element=>{
        const css=getComputedStyle(element),rect=element.getBoundingClientRect();
        return {background:css.backgroundImage,fill:css.backgroundColor,color:css.color,
          border:css.borderInlineStartWidth,borderColor:css.borderInlineStartColor,
          shadow:css.boxShadow,radius:css.borderTopLeftRadius,width:rect.width};
      };
      const reader=document.getElementById('chatBody');
      return {user:paint(userBody),code:paint(pre),quote:paint(quote),tool:paint(toolLabel),
        reader:paint(reader),readerOverflow:reader.scrollWidth-reader.clientWidth,
        codeScroll:pre.scrollWidth,codeWidth:pre.clientWidth,fixtureHeight:fixture.getBoundingClientRect().height,
        wasHidden};
    })()`);
    const removeRichScene = wasHidden => js(`(() => {
      const fixture=document.getElementById('appearance-rich-fixture');
      fixture?.remove();document.getElementById('timelineEmpty').hidden=${JSON.stringify(wasHidden)};
    })()`);
    const assertGlobalSkin = (style, actual, baseline) => {
      assert.equal(actual.style,style);
      assert.equal(actual.theme,baseline.theme);
      const decorated = [];
      for (const [region, elements] of Object.entries(actual.regions)) {
        const reference = baseline.regions[region];
        assert.equal(elements.length,reference.length,style+' / '+region+' probe count');
        assert.ok(elements.some(element=>element?.visible),style+' / '+region+' is not visible in chat');
        const decoratedRegion = elements.some((element,index) =>
          element?.visible && reference[index]?.visible &&
          JSON.stringify(element.decoration)!==JSON.stringify(reference[index].decoration)
        );
        const recoloredRegion = elements.some((element,index) =>
          element?.visible && reference[index]?.visible &&
          JSON.stringify(element.colors)!==JSON.stringify(reference[index].colors)
        );
        // Flat Win95 and true-black Midnight legitimately use fewer ornaments on the
        // canvas itself. Even so, every *visible* region must differ, and most must
        // visibly change ornament/typography rather than merely inherit a new palette.
        if (style !== 'classic') assert.ok(decoratedRegion || recoloredRegion,
          style+' does not change the visible '+region+' surface');
        if (decoratedRegion) decorated.push(region);
      }
      if (style !== 'classic') assert.ok(decorated.length>=4,
        style+' recolors too many regions without skin-specific chrome: '+decorated.join(', '));
      return decorated;
    };
    await js(`document.querySelector('[data-tab="appearance"]').click()`);
    assert.equal(await js(`document.getElementById('appearancePanel').classList.contains('is-active')`),true);
    await screenshot('default-dark.png');
    const classicDarkSettings = await deepSettingsSnapshot();
    // Both Classic baselines are necessary: Windows 95/Solar select light, other skins dark.
    await js(`document.getElementById('backToChat').click()`);
    const classicDark = await skinSnapshot();
    const classicDarkDeep = await deepChatSnapshot();
    const classicDarkRich = await richScene();
    await removeRichScene(classicDarkRich.wasHidden);
    await js(`document.querySelector('[data-tab="appearance"]').click()`);
    await change('appearanceTheme','light');
    const classicLightSettings = await deepSettingsSnapshot();
    await js(`document.getElementById('backToChat').click()`);
    const classicLight = await skinSnapshot();
    const classicLightDeep = await deepChatSnapshot();
    const classicLightRich = await richScene();
    await removeRichScene(classicLightRich.wasHidden);
    await js(`document.querySelector('[data-tab="appearance"]').click()`);
    await change('appearanceTheme','dark');
    const skinResults = [];
    for (const preset of ['cyberpunk','gamer','futuristic','win95','terminal','synthwave','midnight','solar','classic']) {
      await js(`document.querySelector('[data-preset="${preset}"]').click()`);
      await js('new Promise(r=>setTimeout(r,45))');
      assert.equal(await js(`window.fixtureState.config.ui.appearance.style`),preset);
      assert.equal(await js(`document.documentElement.dataset.appearanceStyle`),preset);
      assert.equal(await js(`document.querySelectorAll('.appearance-preset[aria-pressed="true"]').length`),1);
      assert.equal(await js(`document.querySelector('.appearance-preset[aria-pressed="true"]').dataset.preset`),preset);
      assert.equal(await js(`document.getElementById('appearanceTheme').value`),['win95','solar'].includes(preset)?'light':'dark');
      await verifyPopoverPalette();
      const controls = await js(`[...document.querySelectorAll('#appearancePresets button[data-preset]')].map(button => ({
        style:button.dataset.preset, name:button.textContent.trim(),
        pressed:button.getAttribute('aria-pressed'), keyboard:button.tabIndex>=0,
        visible:button.getClientRects().length>0
      }))`);
      assert.equal(controls.length,9,'All nine styles must be selectable');
      assert.ok(controls.every(button=>button.name && button.keyboard && button.visible),'Style buttons need accessible labels and keyboard access');
      assert.deepEqual(controls.filter(button=>button.pressed==='true').map(button=>button.style),[preset]);
      const deepSettings = await deepSettingsSnapshot();
      const referenceSettings = ['win95','solar'].includes(preset)?classicLightSettings:classicDarkSettings;
      assert.ok(deepSettings.card.width>150 && deepSettings.cardControls>0,
        preset+' settings card or controls lost layout: '+JSON.stringify(deepSettings));
      assert.ok(deepSettings.overflow<=2,
        preset+' settings card leaks horizontal overflow: '+JSON.stringify(deepSettings));
      if (preset!=='classic') for (const surface of ['card','preview']) {
        const decorate = value=>[value.background,value.border,value.radius,value.shadow];
        assert.notDeepEqual(decorate(deepSettings[surface]),decorate(referenceSettings[surface]),
          preset+' '+surface+' lost global skin decoration (palette-only is not sufficient)');
      }
      await screenshot('skin-'+preset+'-settings.png');
      await js(`document.getElementById('backToChat').click()`);
      const currentSkin = await skinSnapshot();
      const decorated = assertGlobalSkin(preset,currentSkin,['win95','solar'].includes(preset)?classicLight:classicDark);
      const deepChat = await deepChatSnapshot();
      const referenceDeep = ['win95','solar'].includes(preset)?classicLightDeep:classicDarkDeep;
      const visual = value=>[value.background,value.fill,value.shadow,value.border,value.radius,value.outline];
      assert.ok(deepChat.visibleDock,preset+' production composer-dock cannot be displayed by status fixture');
      assert.notDeepEqual(visual(deepChat.idleNav),visual(deepChat.selectedNav),
        preset+' sidebar selected row has no discernible active-state feedback');
      assert.notDeepEqual(visual(deepChat.idleComposer),visual(deepChat.focusedComposer),
        preset+' composer focus has no visible style change');
      if(preset!=='classic') {
        assert.notDeepEqual(visual(deepChat.shownDock),visual(referenceDeep.shownDock),
          preset+' work dock inherits Classic styling instead of its skin');
        assert.notDeepEqual(visual(deepChat.focusedComposer),visual(referenceDeep.focusedComposer),
          preset+' focused composer inherits Classic styling instead of its skin');
        assert.ok(deepChat.focusArt.content!=='none' && deepChat.focusArt.background!=='none',
          preset+' focused composer lost its accessible decorative focus rail');
      }
      for(const effect of deepChat.fullscreenEffects) {
        assert.equal(effect.filter,'none',preset+' permanent whole-surface GPU filter on '+effect.selector);
        assert.ok(effect.willChange==='auto' || effect.willChange==='contents',
          preset+' permanent layer allocation (will-change) on '+effect.selector+': '+effect.willChange);
      }
      await js(`(() => {
        const input=document.getElementById('chatInput');
        input.value='A workspace in the '+${JSON.stringify(preset)}+' style.';
        input.dispatchEvent(new Event('input',{bubbles:true}));
      })()`);
      if(preset==='gamer'||preset==='futuristic') {
        await js(`(() => {
          document.getElementById('chatInput').focus();
          document.getElementById('sidebarPlugins').classList.add('is-sel');
          document.getElementById('backgroundExecStatus').hidden=false;
        })()`);
        await screenshot('skin-'+preset+'-deep-focus.png');
        await js(`(() => {
          document.getElementById('chatInput').blur();
          document.getElementById('sidebarPlugins').classList.remove('is-sel');
          document.getElementById('backgroundExecStatus').hidden=true;
        })()`);
      }
      const rich = await richScene();
      const referenceRich = ['win95','solar'].includes(preset)?classicLightRich:classicDarkRich;
      assert.ok(rich.fixtureHeight>75 && rich.readerOverflow<=2,
        preset+' rich fixture overflows the reader: '+JSON.stringify(rich));
      assert.ok(rich.codeScroll>=rich.codeWidth && rich.codeWidth>100,
        preset+' code block clipping or invalid width: '+JSON.stringify(rich));
      if(preset!=='classic')for(const surface of ['user','code','quote','tool','reader']) {
        // Win95 intentionally has --scene-reader:none: the flat document has no
        // ambient background by design, while its message/code/tool frames carry bevels.
        if(preset==='win95' && surface==='reader')continue;
        const paint = value=>[value.background,value.fill,value.color,value.border,value.borderColor,value.shadow,value.radius];
        assert.notDeepEqual(paint(rich[surface]),paint(referenceRich[surface]),
          preset+' rich '+surface+' surface matches Classic instead of scene styling');
      }
      if(['gamer','futuristic','win95','classic'].includes(preset))
        await screenshot('skin-'+preset+'-rich.png');
      await removeRichScene(rich.wasHidden);
      if (preset === 'gamer' || preset === 'futuristic') {
        const accent = await js(`getComputedStyle(document.documentElement).getPropertyValue('--accent-fill').trim().toLowerCase()`);
        assert.match(accent,/^#[0-9a-f]{6}$/);
        const [red,green,blue] = [1,3,5].map(at=>parseInt(accent.slice(at,at+2),16));
        if (preset==='gamer') {
          assert.ok(green>=220 && green>red && green>blue*1.5,
            'Gamer accent needs bright neon green, actual '+accent);
        } else {
          assert.ok(green>=210 && blue>=220 && blue>red*1.3,
            'Futuristic accent needs bright fluorescent cyan, actual '+accent);
        }
        const accentInk = await js(`getComputedStyle(document.documentElement).getPropertyValue('--ink').trim().toLowerCase()`);
        assert.equal(accentInk,'#ffffff',preset+' dark surfaces must retain white readable text');
        // Assert the actual skin-gradient's color stops, not just the single editable accent.
        // RGB Gaming needs green, cyan and pink/violet; Futuristic needs blue, cyan and icy white.
        const gradient = await js(`getComputedStyle(document.documentElement).getPropertyValue('--skin-gradient').trim()`);
        const stops = [...gradient.matchAll(/#[0-9a-f]{6}\b/gi)].map(([hex]) =>
          [1,3,5].map(at=>parseInt(hex.slice(at,at+2),16))
        );
        assert.ok(stops.length>=3,preset+' requires a multi-stop luminous color treatment: '+JSON.stringify({gradient,stops}));
        if (preset==='gamer') {
          assert.ok(stops.some(([r,g,b])=>g>r*1.4 && g>b*1.1),'Gamer RGB gradient needs green');
          assert.ok(stops.some(([r,g,b])=>b>r*1.5 && g>r*1.5),'Gamer RGB gradient needs cyan');
          assert.ok(stops.some(([r,g,b])=>r>g*1.5 && b>g*1.5),'Gamer RGB gradient needs violet/magenta');
        } else {
          assert.ok(stops.some(([r,g,b])=>b>r*3 && b>g*1.25),'Futuristic gradient needs electric blue');
          assert.ok(stops.some(([r,g,b])=>g>r*2 && b>r*2),'Futuristic gradient needs cyan');
          assert.ok(stops.some(([r,g,b])=>Math.min(r,g,b)>=190),'Futuristic gradient needs fluorescent icy white');
        }
      }
      await screenshot('skin-'+preset+'-chat.png');
      // A skin must keep the real conversation column usable after responsive zoom,
      // not only keep the Appearance preset grid inside its scroll container.
      win.setSize(800,900);win.webContents.setZoomFactor(1.17);
      const expectedWidth=Math.round(win.getContentSize()[0]/1.17);
      for(let i=0;i<200 && Math.abs(await js('innerWidth')-expectedWidth)>1;i++) await new Promise(r=>setTimeout(r,10));
      const chatGeometry = await js(`(() => {
        const app=document.querySelector('.app'),composer=document.querySelector('.composer');
        const composerRect=composer.getBoundingClientRect(),viewport=innerWidth;
        return {viewport,body:document.documentElement.scrollWidth,app:app.scrollWidth,appWidth:app.clientWidth,
          composerLeft:composerRect.left,composerRight:composerRect.right,composerWidth:composerRect.width};
      })()`);
      assert.ok(chatGeometry.body<=chatGeometry.viewport+2 &&
        chatGeometry.app<=chatGeometry.appWidth+2 &&
        chatGeometry.composerWidth>0 && chatGeometry.composerLeft>=-2 &&
        chatGeometry.composerRight<=chatGeometry.viewport+2,
      preset+' chat/composer overflow at zoom 1.17: '+JSON.stringify(chatGeometry));
      if (preset==='gamer' || preset==='futuristic') await screenshot('skin-'+preset+'-narrow.png');
      win.setSize(1100,900);win.webContents.setZoomFactor(1);
      for(let i=0;i<200 && Math.abs(await js('innerWidth')-win.getContentSize()[0])>1;i++) await new Promise(r=>setTimeout(r,10));
      if (preset==='gamer' || preset==='futuristic') {
        // Distinguish intended per-skin HUD ornaments from a higher-specificity
        // generic declaration accidentally winning the cascade.
        const ornament = await js(`(() => {
          const brand=getComputedStyle(document.querySelector('.sidebar-brand'),'::after');
          const head=getComputedStyle(document.querySelector('.chat-head'));
          return {brandWidth:brand.width,brandArt:brand.backgroundImage,chatArt:head.backgroundImage};
        })()`);
        assert.ok(Math.abs(parseFloat(ornament.brandWidth)-(preset==='gamer'?85:98))<1,
          preset+' specific sidebar branding lost to generic CSS specificity: '+JSON.stringify(ornament));
        assert.ok(ornament.chatArt.startsWith('linear-gradient('),
          preset+' chat header lost styled background: '+JSON.stringify(ornament));
      }
      skinResults.push({style:preset,theme:currentSkin.theme,regions:Object.keys(currentSkin.regions),decorated});
      await js(`document.querySelector('[data-tab="appearance"]').click()`);
      if (preset === 'cyberpunk') {
        assert.ok((await js(`getComputedStyle(document.querySelector('.sidebar')).backgroundImage`)).includes('linear-gradient'));
        await screenshot('preset-cyberpunk.png');
      }
      if (preset === 'win95') {
        assert.equal(await js(`getComputedStyle(document.documentElement).getPropertyValue('--r-lg').trim()`),'0px');
        await screenshot('preset-win95.png');
      }
      if (preset === 'gamer') await screenshot('preset-gamer.png');
    }
    // The main fixture deliberately freezes motion for deterministic screenshots. Turn that
    // override off while emulating the OS preference, otherwise a reduced-motion test is vacuous.
    await js(`document.querySelector('[data-preset="gamer"]').click()`);
    const debuggerClient = win.webContents.debugger;
    debuggerClient.attach('1.3');
    let reducedMotion;
    try {
      await debuggerClient.sendCommand('Emulation.setEmulatedMedia',
        {features:[{name:'prefers-reduced-motion',value:'reduce'}]});
      reducedMotion = await js(`(() => {
        document.getElementById('fixture-motion-freeze').disabled=true;
        const button=document.querySelector('[data-preset="gamer"]');
        return {matches:matchMedia('(prefers-reduced-motion: reduce)').matches,
          buttonTransition:getComputedStyle(button).transitionDuration,
          buttonAnimation:getComputedStyle(button).animationName,
          topbarAnimation:getComputedStyle(document.querySelector('.app-topbar')).animationName,
          largeSurfaces:['.app','.app-topbar','.sidebar','.card.is-session','#chatBody','.composer']
            .map(selector=>{
              const css=getComputedStyle(document.querySelector(selector));
              return {selector,animation:css.animationName,transition:css.transitionProperty,
                duration:css.transitionDuration,filter:css.filter,willChange:css.willChange};
            })};
      })()`);
    } finally {
      await js(`document.getElementById('fixture-motion-freeze').disabled=false`);
      await debuggerClient.sendCommand('Emulation.setEmulatedMedia',{features:[]});
      debuggerClient.detach();
    }
    assert.equal(reducedMotion.matches,true,'Reduced motion must be emulated, not fixture-forced');
    assert.ok(reducedMotion.buttonTransition.split(',').every(value=>parseFloat(value)===0),
      'Style selection must not transition when reduced motion is requested');
    assert.equal(reducedMotion.buttonAnimation,'none','No animated skin selection in reduced motion');
    assert.equal(reducedMotion.topbarAnimation,'none','Gamer RGB topbar must stop moving in reduced motion');
    for(const surface of reducedMotion.largeSurfaces) {
      assert.equal(surface.animation,'none','Reduced motion must stop large-area animation on '+surface.selector);
      assert.equal(surface.filter,'none','Reduced motion must avoid whole-surface filters on '+surface.selector);
      assert.ok(surface.willChange==='auto' || surface.willChange==='contents',
        'Reduced motion must not allocate permanent compositor layers on '+surface.selector+': '+surface.willChange);
      const properties=surface.transition.split(',').map(value=>value.trim());
      const durations=surface.duration.split(',').map(value=>parseFloat(value));
      const layout=/^(?:all|width|height|top|left|right|bottom|inset|margin|padding|grid-template|flex-basis|font-size)/;
      assert.ok(!properties.some((property,index)=>layout.test(property) && (durations[index%durations.length]??0)>0),
        'Reduced motion still transitions layout on '+surface.selector+': '+JSON.stringify(surface));
    }
    const textContrast = async (preset,mode,selector) => {
      await js(`document.querySelector('[data-preset="${preset}"]').click()`);
      await change('appearanceTheme',mode);
      await js(`document.getElementById('backToChat').click()`);
      const result = await js(`(() => {
        const element=document.querySelector(${JSON.stringify(selector)});
        const ink=getComputedStyle(element).color;
        // Evaluate the visible underlying surface rather than comparing
        // transparent toolbar buttons with the sidebar behind their parent.
        let background='transparent';
        for (let ancestor=element;ancestor;ancestor=ancestor.parentElement) {
          const candidate=getComputedStyle(ancestor).backgroundColor;
          if (candidate!=='transparent' && candidate!=='rgba(0, 0, 0, 0)') {
            background=candidate;
            break;
          }
        }
        const numbers=color=>(color.match(/[0-9.]+/g)??[]).slice(0,3).map(Number);
        const luminance=color=>{
          const [red,green,blue]=numbers(color).map(channel=>{
            const value=channel/255;
            return value<=.04045?value/12.92:((value+.055)/1.055)**2.4;
          });
          return red*.2126+green*.7152+blue*.0722;
        };
        const a=luminance(ink),b=luminance(background);
        return {ink,background,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
      })()`);
      await screenshot('skin-'+preset+'-'+mode+'-contrast.png');
      assert.ok(result.ratio>=4.5,`${preset} ${mode} poor readable label contrast ${selector}: ${JSON.stringify(result)}`);
      await js(`document.querySelector('[data-tab="appearance"]').click()`);
      return result;
    };
    // Presets choose their starting theme, but the user can switch theme later.
    // Hard-coded neon/paper backgrounds must not create white-on-gray or cyan-on-pale text.
    await textContrast('win95','dark','.sidebar-primary-link');
    await textContrast('win95','dark','.sidebar-bottom > .btn');
    await textContrast('gamer','light','.sidebar-session-label');
    await js(`document.querySelector('[data-preset="classic"]').click()`);
    await change('appearance-accent-hex','#a855f7');
    await change('appearance-sidebar-hex','#35234c');
    await change('appearance-background-hex','#19151f');
    assert.equal(await js(`window.fixtureState.config.ui.appearance.dark.sidebar`),'#35234c');
    assert.equal(await js(`window.fixtureState.config.ui.tabsToKeepOpen`),7);
    assert.equal(await js(`window.fixtureState.config.ui.finishAction`),'notify');
    await screenshot('custom-purple.png');
    await change('appearanceTheme','light');
    assert.equal(await js(`document.getElementById('appearance-sidebar-hex').value`),'#E9EDF2');
    await change('appearance-sidebar-hex','#eec4df');
    await change('appearance-accent-hex','#8b2676');
    await screenshot('custom-light.png');
    await change('appearanceTheme','dark');
    assert.equal(await js(`document.getElementById('appearance-sidebar-hex').value`),'#35234C');
    await js(`document.getElementById('appearanceTranslucent').click()`);
    assert.equal(await js(`getComputedStyle(document.querySelector('.sidebar')).backdropFilter`),'none');
    await verifyPopoverPalette();
    await js(`document.getElementById('appearanceTranslucent').click()`);
    assert.ok((await js(`getComputedStyle(document.querySelector('.sidebar')).backdropFilter`)).includes('blur'));
    // Dirty HEX edits survive status pushes; invalid text cannot reach storage.
    await js(`window.countBefore=window.savedPatches.length;const hex=document.getElementById('appearance-sidebar-hex');hex.focus();hex.value='#12';hex.dispatchEvent(new Event('input',{bubbles:true}));window.pushState()`);
    assert.equal(await js(`document.getElementById('appearance-sidebar-hex').value`),'#12');
    assert.equal(await js(`window.savedPatches.length===window.countBefore`),true);
    await js(`document.getElementById('appearance-sidebar-hex').dispatchEvent(new Event('change',{bubbles:true}))`);
    assert.equal(await js(`document.getElementById('appearance-sidebar-hex').value`),'#35234C');
    // Two queued edits plus a stale push retain the latest request and save both colors.
    await js('window.holdSave=true');
    await change('appearance-accent-hex','#72ea34');
    await change('appearance-sidebar-hex','#23454e');
    await js('window.pushState()');
    assert.equal(await js(`document.documentElement.style.getPropertyValue('--accent-fill')`),'#72ea34');
    assert.equal(await js(`document.getElementById('appearance-sidebar-hex').value.toUpperCase()`),'#23454E');
    await js('window.holdSave=false;window.releaseSave()');
    await js('new Promise(r=>setTimeout(r,100))');
    assert.deepEqual(await js(`window.fixtureState.config.ui.appearance.dark`),{background:'#19151f',sidebar:'#23454e',accent:'#72ea34',contrast:60});
    await js('window.rejectSave=true');
    await change('appearance-sidebar-hex','#ff00ff');
    assert.equal(await js("window.fixtureState.config.ui.appearance.dark.sidebar"),'#23454e');
    assert.equal(await js("document.documentElement.style.getPropertyValue('--sidebar-color')"),'#23454e');
    await change('appearanceFont','serif');
    assert.ok((await js(`getComputedStyle(document.body).fontFamily`)).includes('Georgia'));
    await change('appearanceSize','18');
    assert.equal(await js(`Math.round(parseFloat(getComputedStyle(document.body).fontSize))`),18);
    const layout=[];
    for(const [width,zoom] of [[1100,1],[800,1.17],[1100,1.5],[640,1]]) {
      win.setSize(width,900); win.webContents.setZoomFactor(zoom);
      // Resize and zoom land asynchronously; on slow CI runners two frames still showed the previous
      // zoom (640 px at 1.5 read as 427 px). Wait until the page reports this window at this zoom.
      const expected=Math.round(win.getContentSize()[0]/zoom);
      for(let i=0;i<200 && Math.abs(await js('innerWidth')-expected)>1;i++) await new Promise(r=>setTimeout(r,10));
      await js('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
      const geometry=await js(`(() => {const panel=document.getElementById('appearancePanel');return {viewport:innerWidth,scroll:panel.scrollWidth,width:panel.clientWidth,body:document.documentElement.scrollWidth};})()`);
      assert.ok(geometry.scroll<=geometry.width+1,JSON.stringify({width,zoom,geometry}));
      assert.ok(geometry.body<=geometry.viewport+1,JSON.stringify(geometry));
      layout.push({windowWidth:width,zoom,...geometry});
    }
    await screenshot('large-text-narrow.png');
    win.setSize(1100,900);win.webContents.setZoomFactor(1);
    await js(`document.getElementById('appearanceReset').click()`);
    await js('new Promise(r=>setTimeout(r,100))');
    assert.equal(await js(`window.fixtureState.config.ui.appearance.style`),'classic');
    assert.equal(await js(`window.fixtureState.config.ui.appearance.fontSize`),14);
    assert.equal(await js(`window.fixtureState.config.ui.appearance.dark.sidebar`),'#1a2129');
    assert.equal(await js(`window.fixtureState.config.ui.appearance.light.sidebar`),'#e9edf2');
    // Reload the production renderer with the same saved settings snapshot.
    await js(`window.savedUi=structuredClone(window.fixtureState.config.ui);window.pushState()`);
    await js(`document.querySelector('[data-preset="gamer"]').click()`);
    await js('new Promise(r=>setTimeout(r,100))');
    await change('appearance-sidebar-hex','#331155');
    const savedUi = await js('window.fixtureState.config.ui');
    await win.reload();
    for(let i=0;i<100 && !(await js('!!window.fixtureReady'));i++) await new Promise(r=>setTimeout(r,25));
    await js(`window.fixtureState.config.ui=${JSON.stringify(savedUi)};window.pushState();document.querySelector('[data-tab="appearance"]').click()`);
    assert.equal(await js(`document.getElementById('appearance-sidebar-hex').value`),'#331155');
    assert.equal(await js(`document.documentElement.dataset.appearanceStyle`),'gamer');
    await change('uiLanguage','zh-CN');
    assert.equal(await js(`document.getElementById('appearanceTitle').textContent`),'外观');
    assert.notEqual(await js(`document.querySelector('[data-preset="gamer"] .appearance-preset-caption > span').textContent`),'Arcade energy');
    await screenshot('chinese.png');
    await change('uiLanguage','en');
    assert.equal(await js(`document.querySelector('[data-preset="gamer"] .appearance-preset-caption > span').textContent`),'Arcade energy');
    await js(`document.getElementById('backToChat').click();document.getElementById('chatInput').value='A workspace in your colors.'`);
    await screenshot('chat.png');
    await change('uiLanguage','es');
    await js(`document.querySelector('[data-tab="appearance"]').click();document.querySelector('[data-preset="cyberpunk"]').click()`);
    await js('new Promise(r=>setTimeout(r,100))');
    assert.equal(await js('document.documentElement.dataset.appearanceStyle'),'cyberpunk');
    assert.equal(await js('window.fixtureState.config.ui.appearance.style'),'cyberpunk');
    assert.equal(await js('window.fixtureState.config.ui.theme'),'dark');
    const cyberpunkLayout=[];
    for(const [width,zoom] of [[1100,1],[800,1.17],[1100,1.5],[640,1]]) {
      win.setSize(width,900); win.webContents.setZoomFactor(zoom);
      await js('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
      // Chromium applies the new zoom asynchronously after the native resize.
      await js('new Promise(r=>setTimeout(r,200))');
      const geometry=await js(`(() => {const panel=document.getElementById('appearancePanel');return {viewport:innerWidth,scroll:panel.scrollWidth,width:panel.clientWidth,body:document.documentElement.scrollWidth};})()`);
      assert.ok(geometry.scroll<=geometry.width+1,JSON.stringify({width,zoom,geometry}));
      assert.ok(geometry.body<=geometry.viewport+1,JSON.stringify(geometry));
      cyberpunkLayout.push({windowWidth:width,zoom,...geometry});
    }
    win.setSize(1100,900);win.webContents.setZoomFactor(1);
    await screenshot('cyberpunk-appearance.png');
    const cyberUi = await js('window.fixtureState.config.ui');
    await win.reload();
    for(let i=0;i<100 && !(await js('!!window.fixtureReady'));i++) await new Promise(r=>setTimeout(r,25));
    await js(`window.fixtureState.config.ui=${JSON.stringify(cyberUi)};window.pushState();document.querySelector('[data-tab="appearance"]').click()`);
    assert.equal(await js('document.documentElement.dataset.appearanceStyle'),'cyberpunk');
    await js(`document.getElementById('backToChat').click();document.getElementById('chatInput').value='Vamos a construir el siguiente nivel.'`);
    await screenshot('cyberpunk-chat.png');
    await js(`document.querySelector('[data-tab="appearance"]').click();document.getElementById('appearanceReset').click()`);
    await js('new Promise(r=>setTimeout(r,100))');
    assert.equal(await js('document.documentElement.dataset.appearanceStyle'),'classic');
    fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({arbitraryColors:true,separateThemes:true,translucency:true,dirtyPush:true,queuedSave:true,saveFailureRollback:true,reload:true,reset:true,cyberpunkPersistence:true,cyberpunkReset:true,globalSkins:skinResults,accessibleStyleControls:true,reducedMotion,cyberpunkLayout,layout},null,2));
    console.log('Appearance Electron checks passed. '+output);
  } finally { win?.destroy(); await server.close(); }
  app.quit();
}).catch(error=>{console.error(error);app.exit(1)});
