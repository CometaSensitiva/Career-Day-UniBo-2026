import { $, clearChildren, createEl, safeScrollIntoView } from '../shared/dom.js?v=20260317-23';

export function getStandPosition(standId, mapLayout) {
    const node = $(`stand-${standId}`);
    if (!node || !mapLayout) return null;
    const mapRect = mapLayout.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    return {
        x: nodeRect.left - mapRect.left + (nodeRect.width / 2),
        y: nodeRect.top - mapRect.top + (nodeRect.height / 2)
    };
}

export function buildRouteStops({ state, getVisitFlag, getCompanyInterest, getApplicationOnlineFlag }) {
    const stops = [];
    state.companies.forEach((company) => {
        if (!company.hasConfirmedStand) return;
        if (getApplicationOnlineFlag(company.id)) return;
        const visitScore = getVisitFlag(company.id);
        const interest = getCompanyInterest(company.id);
        if (visitScore > 0 || interest === 'interested') {
            const position = getStandPosition(company.stand, state.dom.pavilionMapLayout);
            if (!position) return;
            stops.push({
                companyId: company.id,
                name: company.name,
                stand: company.stand,
                visitScore,
                interested: interest === 'interested',
                priority: visitScore > 0 ? visitScore : 0.5,
                x: position.x,
                y: position.y
            });
        }
    });
    return stops;
}

export function optimizeRoute(stops, mode, mapLayout) {
    if (stops.length <= 2) return stops;
    const entrance = { x: mapLayout.getBoundingClientRect().width / 2, y: mapLayout.getBoundingClientRect().height };

    if (mode === 'smooth') {
        return twoOptImprove(nearestNeighborOrder(stops, entrance));
    }

    const visitStops = stops.filter((stop) => stop.visitScore > 0).sort((a, b) => b.visitScore - a.visitScore);
    const interestOnly = stops.filter((stop) => stop.visitScore === 0);
    const scoreGroups = {};
    visitStops.forEach((stop) => {
        (scoreGroups[stop.visitScore] = scoreGroups[stop.visitScore] || []).push(stop);
    });

    const orderedVisits = [];
    let lastPosition = entrance;
    Object.keys(scoreGroups).map(Number).sort((a, b) => b - a).forEach((score) => {
        const improved = twoOptImprove(nearestNeighborOrder(scoreGroups[score], lastPosition));
        orderedVisits.push(...improved);
        if (improved.length > 0) lastPosition = improved[improved.length - 1];
    });

    return [...orderedVisits, ...twoOptImprove(nearestNeighborOrder(interestOnly, lastPosition))];
}

export function clearRouteVisuals(state) {
    const existing = $('route-overlay');
    if (existing) existing.remove();
    document.querySelectorAll('.stand-box.on-route').forEach((node) => node.classList.remove('on-route'));
    state.dom.itineraryPanel?.classList.add('hidden');
    state.dom.clearRouteBtn?.classList.add('hidden');
    state.dom.exportRouteBtn?.classList.add('hidden');
}

export function drawRoute(route, state) {
    clearRouteVisuals(state);
    if (!route.length) return;

    const mapLayout = state.dom.pavilionMapLayout;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('route-svg');
    svg.setAttribute('width', mapLayout.scrollWidth);
    svg.setAttribute('height', mapLayout.scrollHeight);
    svg.id = 'route-overlay';

    const entrance = { x: mapLayout.scrollWidth / 2, y: mapLayout.scrollHeight - 20 };
    const points = [entrance, ...route.map((stop) => ({ x: stop.x, y: stop.y })), entrance];
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' '));
    path.classList.add('route-line');
    svg.appendChild(path);

    route.forEach((stop, index) => {
        const priorityClass = stop.visitScore >= 4 ? 'priority-high' : stop.visitScore >= 2 ? 'priority-medium' : '';
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', stop.x);
        circle.setAttribute('cy', stop.y);
        circle.setAttribute('r', 12);
        circle.classList.add('route-marker-bg');
        if (priorityClass) circle.classList.add(priorityClass);
        svg.appendChild(circle);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', stop.x);
        text.setAttribute('y', stop.y);
        text.classList.add('route-marker');
        text.textContent = String(index + 1);
        svg.appendChild(text);

        $(`stand-${stop.stand}`)?.classList.add('on-route');
    });

    const entranceGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const entranceCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    entranceCircle.setAttribute('cx', entrance.x);
    entranceCircle.setAttribute('cy', entrance.y);
    entranceCircle.setAttribute('r', 10);
    entranceCircle.setAttribute('fill', '#0f172a');
    entranceCircle.setAttribute('stroke', 'white');
    entranceCircle.setAttribute('stroke-width', '2');
    entranceGroup.appendChild(entranceCircle);
    const entranceText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    entranceText.setAttribute('x', entrance.x);
    entranceText.setAttribute('y', entrance.y);
    entranceText.setAttribute('font-size', '8');
    entranceText.setAttribute('fill', 'white');
    entranceText.setAttribute('text-anchor', 'middle');
    entranceText.setAttribute('dominant-baseline', 'central');
    entranceText.setAttribute('font-weight', '700');
    entranceText.textContent = 'E';
    entranceGroup.appendChild(entranceText);
    svg.appendChild(entranceGroup);

    mapLayout.style.position = 'relative';
    mapLayout.appendChild(svg);
}

export function renderItineraryPanel(route, state) {
    const panel = state.dom.itineraryPanel;
    const list = state.dom.itineraryList;
    if (!panel || !list) return;

    clearChildren(list);
    if (!route.length) {
        panel.classList.add('hidden');
        return;
    }

    panel.classList.remove('hidden');
    state.dom.clearRouteBtn?.classList.remove('hidden');
    state.dom.exportRouteBtn?.classList.remove('hidden');

    const groups = [];
    let currentGroup = null;
    route.forEach((stop, index) => {
        const label = stop.visitScore >= 4 ? 'Priorita alta' : stop.visitScore >= 2 ? 'Priorita media' : stop.visitScore === 1 ? 'Priorita bassa' : 'Interessato';
        if (!currentGroup || currentGroup.label !== label) {
            currentGroup = { label, stops: [] };
            groups.push(currentGroup);
        }
        currentGroup.stops.push({ ...stop, index });
    });

    const palette = {
        'Priorita alta': { badge: 'bg-red-500', text: 'text-red-700' },
        'Priorita media': { badge: 'bg-amber-500', text: 'text-amber-700' },
        'Priorita bassa': { badge: 'bg-sky-500', text: 'text-sky-700' },
        'Interessato': { badge: 'bg-indigo-500', text: 'text-indigo-700' }
    };

    groups.forEach((group) => {
        const colors = palette[group.label] || palette.Interessato;
        const wrapper = createEl('div', { className: 'mb-2' });
        const header = createEl('div', { className: 'flex items-center gap-2 px-3 py-1.5' });
        header.appendChild(createEl('span', { className: `w-2 h-2 rounded-full ${colors.badge}` }));
        header.appendChild(createEl('span', { className: `text-[10px] font-bold ${colors.text} uppercase tracking-wider`, text: group.label }));
        header.appendChild(createEl('span', { className: 'flex-1 h-px bg-slate-100' }));
        header.appendChild(createEl('span', { className: 'text-[10px] text-slate-400', text: `${group.stops.length} stand` }));

        const listEl = createEl('ul', { className: 'space-y-0.5' });
        group.stops.forEach((stop) => {
            const button = createEl('button', {
                className: 'w-full flex items-center gap-2.5 py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer group',
                attrs: {
                    type: 'button',
                    'data-action': 'scroll-stand',
                    'data-stand': stop.stand
                }
            });
            button.appendChild(createEl('span', {
                className: `${colors.badge} text-white text-[10px] font-extrabold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm`,
                text: String(stop.index + 1)
            }));
            const info = createEl('div', { className: 'flex-1 min-w-0 text-left' });
            info.appendChild(createEl('span', { className: 'text-xs font-bold text-slate-800 block truncate', text: stop.name }));
            info.appendChild(createEl('span', { className: 'text-[10px] text-slate-400', text: `Stand ${stop.stand}` }));
            button.appendChild(info);
            button.appendChild(createEl('span', {
                className: 'text-[11px] text-slate-400 tracking-wide',
                text: stop.visitScore > 0 ? `${'★'.repeat(stop.visitScore)}${'☆'.repeat(5 - stop.visitScore)}` : 'Interesse'
            }));
            listEl.appendChild(button);
        });

        wrapper.appendChild(header);
        wrapper.appendChild(listEl);
        list.appendChild(wrapper);
    });
}

export function scrollToStand(standId) {
    const node = $(`stand-${standId}`);
    if (!node) return;
    safeScrollIntoView(node, { behavior: 'smooth', inline: 'center', block: 'center' });
    node.classList.add('highlighted');
    window.setTimeout(() => node.classList.remove('highlighted'), 2000);
}

export async function exportRouteImage(state) {
    if (!state.ui.currentRoute.length) return;
    const button = state.dom.exportRouteBtn;
    const restoreButton = button ? {
        html: button.innerHTML,
        disabled: button.disabled
    } : null;

    if (button) {
        button.textContent = 'Generazione...';
        button.disabled = true;
    }

    const mapSection = state.dom.mapScrollContainer;
    const mapLayout = state.dom.pavilionMapLayout;
    const original = {
        overflow: mapSection.style.overflow,
        width: mapSection.style.width,
        minWidth: mapSection.style.minWidth
    };

    try {
        if (document.fonts?.ready) {
            await document.fonts.ready;
        }
        const finalCanvas = renderRouteExportCanvas(state, mapLayout);
        const ctx = finalCanvas.getContext('2d');
        if (!ctx) {
            throw new Error('Canvas 2D non disponibile.');
        }

        const blob = await canvasToBlob(finalCanvas, 'image/png');
        downloadBlob(blob, 'itinerario-career-day-2026.png');
        return true;
    } finally {
        mapSection.style.overflow = original.overflow;
        mapSection.style.width = original.width;
        mapSection.style.minWidth = original.minWidth;
        if (button && restoreButton) {
            button.innerHTML = restoreButton.html;
            button.disabled = restoreButton.disabled;
        }
    }
}

function renderRouteExportCanvas(state, mapLayout) {
    const fullWidth = mapLayout.scrollWidth;
    const fullHeight = mapLayout.scrollHeight;
    const headerHeight = 92;
    const outerPad = 36;
    const cardPad = 22;
    const sideWidth = 396;
    const targetMapWidth = Math.min(1120, fullWidth);
    const mapScale = targetMapWidth / fullWidth;
    const targetMapHeight = Math.round((fullHeight + 60) * mapScale);
    const listHeight = 184 + (state.ui.currentRoute.length * 84);
    const contentHeight = Math.max(targetMapHeight + (cardPad * 2), listHeight);
    const finalWidth = (outerPad * 3) + targetMapWidth + sideWidth;
    const finalHeight = headerHeight + (outerPad * 2) + contentHeight;
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(finalWidth * scale));
    canvas.height = Math.max(1, Math.round(finalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Canvas 2D non disponibile.');
    }

    ctx.scale(scale, scale);
    drawExportBackground(ctx, finalWidth, finalHeight, headerHeight);
    drawExportHeader(ctx, finalWidth, headerHeight, state.ui.currentRoute.length, state.dom.routeMode.value);

    const mapCard = {
        x: outerPad,
        y: headerHeight + outerPad,
        width: targetMapWidth + (cardPad * 2),
        height: targetMapHeight + (cardPad * 2)
    };
    const sideCard = {
        x: mapCard.x + mapCard.width + outerPad,
        y: mapCard.y,
        width: sideWidth,
        height: contentHeight
    };

    drawExportCard(ctx, mapCard.x, mapCard.y, mapCard.width, mapCard.height, 28, '#fbf8f4', 'rgba(216, 207, 197, 0.95)');
    drawExportMap(ctx, state, mapLayout, {
        x: mapCard.x + cardPad,
        y: mapCard.y + cardPad,
        width: fullWidth,
        height: fullHeight,
        scale: mapScale
    });

    drawExportCard(ctx, sideCard.x, sideCard.y, sideCard.width, sideCard.height, 28, '#fbf8f4', 'rgba(216, 207, 197, 0.95)');
    drawExportSidebar(ctx, state.ui.currentRoute, sideCard);
    return canvas;
}

function canvasToBlob(canvas, type) {
    return new Promise((resolve, reject) => {
        if (typeof canvas.toBlob !== 'function') {
            try {
                resolve(dataUrlToBlob(canvas.toDataURL(type)));
            } catch (error) {
                reject(error);
            }
            return;
        }
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
                return;
            }
            try {
                resolve(dataUrlToBlob(canvas.toDataURL(type)));
            } catch (error) {
                reject(new Error(error.message || 'Impossibile generare il file PNG.'));
            }
        }, type);
    });
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function dataUrlToBlob(dataUrl) {
    const [header, payload] = String(dataUrl || '').split(',');
    if (!header || !payload) throw new Error('PNG non valido.');
    const mimeMatch = header.match(/data:(.*?);base64/);
    const mime = mimeMatch?.[1] || 'application/octet-stream';
    const binary = window.atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type: mime });
}

function drawExportBackground(ctx, width, height, headerHeight) {
    const background = ctx.createLinearGradient(0, 0, 0, height);
    background.addColorStop(0, '#f7f2ec');
    background.addColorStop(1, '#efe4d7');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#9f1d20';
    ctx.fillRect(0, 0, width, headerHeight);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    for (let x = 40; x < width; x += 88) {
        ctx.fillRect(x, 0, 1, headerHeight);
    }
}

function drawExportHeader(ctx, width, headerHeight, routeCount, routeMode) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 30px Georgia';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('Career Day UniBo 2026', 38, 42);

    ctx.font = '600 18px Inter, system-ui';
    ctx.fillText('Itinerario di visita personalizzato', 38, 68);

    ctx.textAlign = 'right';
    ctx.font = '600 13px Inter, system-ui';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    ctx.fillText(`${routeCount} tappe · ${routeMode === 'smooth' ? 'Percorso fluido' : 'Ordine per priorità'}`, width - 38, 46);
    ctx.fillText('Generato dalla dashboard Career Day', width - 38, 67);
}

function drawExportCard(ctx, x, y, width, height, radius, fillStyle, strokeStyle) {
    ctx.save();
    ctx.shadowColor = 'rgba(54, 37, 25, 0.12)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 12;
    drawRoundedRect(ctx, x, y, width, height, radius, fillStyle, strokeStyle, 1.2);
    ctx.restore();
    drawRoundedRect(ctx, x, y, width, height, radius, fillStyle, strokeStyle, 1.2);
}

function drawExportMap(ctx, state, mapLayout, layout) {
    ctx.save();
    ctx.translate(layout.x, layout.y);
    ctx.scale(layout.scale, layout.scale);
    ctx.fillStyle = '#f4eee7';
    ctx.fillRect(0, 0, layout.width, layout.height + 60);
    drawMapGrid(ctx, layout.width, layout.height + 60);
    drawStandNodesForExport(ctx, mapLayout, state.ui.currentRoute);
    drawRouteOverlay(ctx, state.ui.currentRoute, layout.width, layout.height);
    drawEntranceLabel(ctx, layout.width, layout.height);
    ctx.restore();
}

function drawExportSidebar(ctx, route, card) {
    const padX = 28;
    const top = card.y + 30;
    const contentWidth = card.width - (padX * 2);
    ctx.fillStyle = '#9f1d20';
    ctx.font = '700 24px Georgia';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('Tappe selezionate', card.x + padX, top);

    ctx.fillStyle = '#7a6e64';
    ctx.font = '500 12.5px Inter, system-ui';
    drawWrappedText(ctx, 'Dalla più urgente alla meno urgente, con stand e livello di priorità.', card.x + padX, top + 24, contentWidth, 18, 2);

    const legendTop = top + 64;
    [
        getRoutePriorityVisual({ visitScore: 5 }),
        getRoutePriorityVisual({ visitScore: 3 }),
        getRoutePriorityVisual({ visitScore: 1 }),
        getRoutePriorityVisual({ visitScore: 0 })
    ].forEach((item, index) => {
        const y = legendTop + (index * 22);
        const x = card.x + padX + 2;
        ctx.fillStyle = item.badge;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5d544d';
        ctx.font = '600 11px Inter, system-ui';
        ctx.fillText(item.label, x + 14, y + 4);
    });

    const baseY = legendTop + 80;
    route.forEach((stop, index) => {
        const rowY = baseY + (index * 84);
        const visual = getRoutePriorityVisual(stop);
        const nameX = card.x + padX + 52;
        const maxNameWidth = card.width - (padX * 2) - 170;
        drawRoundedRect(ctx, card.x + padX, rowY, card.width - (padX * 2), 62, 18, visual.softFill, visual.stroke, 1);
        ctx.fillStyle = visual.badge;
        ctx.beginPath();
        ctx.arc(card.x + padX + 26, rowY + 31, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 14px Inter, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(String(index + 1), card.x + padX + 26, rowY + 36);

        ctx.textAlign = 'left';
        ctx.fillStyle = '#221f1b';
        ctx.font = '700 16px Inter, system-ui';
        ctx.fillText(fitTextSingleLine(ctx, stop.name, maxNameWidth), nameX, rowY + 24);
        ctx.fillStyle = '#7a6e64';
        ctx.font = '600 12px Inter, system-ui';
        ctx.fillText(`Stand ${stop.stand}`, nameX, rowY + 44);
        ctx.textAlign = 'right';
        ctx.fillStyle = visual.text;
        ctx.font = '700 12px Inter, system-ui';
        ctx.fillText(getRoutePriorityLabel(stop), card.x + card.width - padX - 16, rowY + 44);
    });
}

function drawMapGrid(ctx, width, height) {
    ctx.fillStyle = 'rgba(159, 29, 32, 0.12)';
    for (let x = 8; x < width; x += 16) {
        for (let y = 8; y < height; y += 16) {
            ctx.beginPath();
            ctx.arc(x, y, 0.7, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function drawStandNodesForExport(ctx, mapLayout, route) {
    const mapRect = mapLayout.getBoundingClientRect();
    const routeByStand = new Map(route.map((stop) => [stop.stand, stop]));
    mapLayout.querySelectorAll('.stand-box').forEach((node) => {
        const rect = node.getBoundingClientRect();
        const standCode = node.dataset.stand || (node.id || '').replace(/^stand-/, '');
        const routeStop = routeByStand.get(standCode);
        const visual = routeStop ? getRoutePriorityVisual(routeStop) : null;
        const x = rect.left - mapRect.left;
        const y = rect.top - mapRect.top;
        const fillStyle = routeStop
            ? visual.softFill
            : node.classList.contains('occupied')
                ? '#fffdfa'
                : '#ece7de';
        const strokeStyle = routeStop
            ? visual.stroke
            : node.classList.contains('occupied')
                ? 'rgba(159, 29, 32, 0.36)'
                : '#d3cbc1';
        drawRoundedRect(
            ctx,
            x,
            y,
            rect.width,
            rect.height,
            Math.min(4, rect.height / 5),
            fillStyle,
            strokeStyle,
            routeStop ? 1.8 : 1
        );
        drawCenteredText(ctx, standCode, x, y, rect.width, rect.height, {
            color: routeStop ? visual.text : '#7a6e64',
            fontSize: getStandExportBaseFontSize(standCode, rect.width, rect.height),
            fontWeight: '700',
            fontFamily: 'Inter, system-ui'
        });
    });
}

function drawRouteOverlay(ctx, route, width, height) {
    if (!Array.isArray(route) || route.length === 0) return;
    const entrance = { x: width / 2, y: height - 20 };
    const points = [entrance, ...route.map((stop) => ({ x: stop.x, y: stop.y })), entrance];
    ctx.save();
    ctx.strokeStyle = 'rgba(97, 83, 74, 0.62)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 6]);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
    ctx.restore();

    route.forEach((stop, index) => {
        const visual = getRoutePriorityVisual(stop);
        ctx.fillStyle = visual.badge;
        ctx.beginPath();
        ctx.arc(stop.x, stop.y, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 11px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(index + 1), stop.x, stop.y + 0.5);
    });

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(entrance.x, entrance.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 8px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('E', entrance.x, entrance.y + 0.5);
}

function drawEntranceLabel(ctx, width, height) {
    ctx.fillStyle = '#7a6e64';
    ctx.font = '600 10px Inter, system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Ingresso Principale Aldo Moro', width / 2, height + 18);
}

function drawRoundedRect(ctx, x, y, width, height, radius, fillStyle, strokeStyle, borderWidth) {
    const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
    ctx.beginPath();
    ctx.moveTo(x + safeRadius, y);
    ctx.lineTo(x + width - safeRadius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    ctx.lineTo(x + width, y + height - safeRadius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
    ctx.lineTo(x + safeRadius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    ctx.lineTo(x, y + safeRadius);
    ctx.quadraticCurveTo(x, y, x + safeRadius, y);
    ctx.closePath();

    ctx.fillStyle = fillStyle;
    ctx.fill();
    if (borderWidth > 0) {
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = borderWidth;
        ctx.stroke();
    }
}

function drawCenteredText(ctx, text, x, y, width, height, style) {
    if (!text) return;
    const maxWidth = Math.max(8, width - 6);
    const maxHeight = Math.max(8, height - 6);
    let fontSize = Math.max(6, Number.parseFloat(style.fontSize) || 9);
    const fontWeight = style.fontWeight || '700';
    const fontFamily = style.fontFamily || 'system-ui';
    ctx.fillStyle = style.color || '#475569';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let lines = [String(text)];
    let lineHeight = Math.max(fontSize, 8) * 1.02;
    while (fontSize >= 5.2) {
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        lines = getPreferredExportLabelLines(text, width, height, ctx, maxWidth);
        lineHeight = Math.max(fontSize, 8) * 1.02;
        const fitsWidth = lines.every((line) => ctx.measureText(line).width <= maxWidth);
        const fitsHeight = (lines.length * lineHeight) <= maxHeight;
        if (fitsWidth && fitsHeight) break;
        fontSize -= 0.5;
    }

    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    const startY = y + (height / 2) - (((lines.length - 1) * lineHeight) / 2);
    lines.forEach((line, index) => {
        ctx.fillText(line, x + (width / 2), startY + (index * lineHeight));
    });
}

function getRoutePriorityLabel(stop) {
    return getRoutePriorityVisual(stop).label;
}

function splitTextToFit(ctx, text, maxWidth) {
    const compact = String(text).replace(/\s+/g, ' ').trim();
    if (!compact) return [''];
    if (ctx.measureText(compact).width <= maxWidth) return [compact];

    const tokens = compact.includes(' ') ? compact.split(' ') : compact.split(/(?<=-)/);
    if (tokens.length <= 1) return [compact];

    const lines = [];
    let current = '';
    tokens.forEach((token) => {
        const candidate = current ? `${current} ${token}`.trim() : token;
        if (current && ctx.measureText(candidate).width > maxWidth) {
            lines.push(current);
            current = token;
        } else {
            current = candidate;
        }
    });
    if (current) lines.push(current);
    return lines.slice(0, 3);
}

function fitTextSingleLine(ctx, text, maxWidth) {
    const compact = String(text || '').replace(/\s+/g, ' ').trim();
    if (!compact) return '';
    if (ctx.measureText(compact).width <= maxWidth) return compact;

    let shortened = compact;
    while (shortened.length > 4 && ctx.measureText(`${shortened}…`).width > maxWidth) {
        shortened = shortened.slice(0, -1).trimEnd();
    }
    return `${shortened}…`;
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 2) {
    const lines = splitTextToFit(ctx, text, maxWidth).slice(0, Math.max(1, maxLines));
    lines.forEach((line, index) => {
        const finalLine = index === maxLines - 1 && lines.length === maxLines
            ? fitTextSingleLine(ctx, line, maxWidth)
            : line;
        ctx.fillText(finalLine, x, y + (index * lineHeight));
    });
}

function getPreferredExportLabelLines(text, width, height, ctx, maxWidth) {
    const compact = String(text || '').replace(/\s+/g, ' ').trim();
    if (!compact) return [''];
    const ranged = getCompactStandRangeLines(compact, width, height);
    if (ranged) return ranged;
    return splitTextToFit(ctx, compact, maxWidth);
}

function getCompactStandRangeLines(text, width, height) {
    if (height < width * 1.1 || text.includes(' ') || !text.includes('-')) return null;
    const parts = text.split('-').map((part) => part.trim()).filter(Boolean);
    if (parts.length !== 2) return null;
    if (!/^[A-Z]/i.test(parts[1])) {
        const prefix = parts[0].match(/^[A-Z]+/i)?.[0] || '';
        parts[1] = `${prefix}${parts[1]}`;
    }
    return parts;
}

function getRoutePriorityVisual(stop) {
    if ((stop?.visitScore || 0) >= 4) {
        return {
            label: 'Priorità alta',
            badge: '#9f1d20',
            text: '#7c1317',
            softFill: '#fff0ef',
            stroke: '#d9b1ad'
        };
    }
    if ((stop?.visitScore || 0) >= 2) {
        return {
            label: 'Priorità media',
            badge: '#c78f22',
            text: '#8a6413',
            softFill: '#fff7e8',
            stroke: '#e0c489'
        };
    }
    if ((stop?.visitScore || 0) === 1) {
        return {
            label: 'Priorità bassa',
            badge: '#2d6679',
            text: '#234e5c',
            softFill: '#eef5f7',
            stroke: '#b6cdd4'
        };
    }
    return {
        label: 'Solo interesse',
        badge: '#6f7d8b',
        text: '#596674',
        softFill: '#f2f5f7',
        stroke: '#c9d2d8'
    };
}

function getStandExportBaseFontSize(standCode, width, height) {
    if (String(standCode).includes('-')) {
        if (height > width * 1.25) {
            return Math.max(6.1, Math.min(7.1, width * 0.22));
        }
        return Math.max(6.2, Math.min(7.4, width * 0.24));
    }
    return Math.max(7.1, Math.min(8.5, Math.min(width * 0.28, height * 0.26)));
}

function distanceBetween(a, b) {
    return Math.sqrt(((a.x - b.x) ** 2) + ((a.y - b.y) ** 2));
}

function nearestNeighborOrder(group, startPos) {
    if (!group.length) return [];
    const ordered = [];
    const remaining = [...group];
    let current = startPos;

    while (remaining.length > 0) {
        let bestIndex = 0;
        let bestDistance = Number.POSITIVE_INFINITY;
        for (let index = 0; index < remaining.length; index += 1) {
            const distance = distanceBetween(current, remaining[index]);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestIndex = index;
            }
        }
        ordered.push(remaining[bestIndex]);
        current = remaining[bestIndex];
        remaining.splice(bestIndex, 1);
    }

    return ordered;
}

function twoOptImprove(route) {
    if (route.length < 4) return route;
    let improved = true;
    let best = [...route];
    while (improved) {
        improved = false;
        for (let i = 0; i < best.length - 2; i += 1) {
            for (let j = i + 2; j < best.length; j += 1) {
                const a = i === 0 ? { x: best[0].x, y: best[0].y + 200 } : best[i - 1];
                const b = best[i];
                const c = best[j];
                const d = j + 1 < best.length ? best[j + 1] : { x: best[best.length - 1].x, y: best[best.length - 1].y + 200 };
                const currentDistance = distanceBetween(a, b) + distanceBetween(c, d);
                const newDistance = distanceBetween(a, c) + distanceBetween(b, d);
                if (newDistance < currentDistance - 1) {
                    const reversed = best.slice(i, j + 1).reverse();
                    best = [...best.slice(0, i), ...reversed, ...best.slice(j + 1)];
                    improved = true;
                }
            }
        }
    }
    return best;
}
