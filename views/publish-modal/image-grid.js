// views/publish-modal/image-grid.js
//
// Shared renderer for the image-picker grid used by BOTH the WeChat material
// library picker and the "本篇引用" (referenced images) picker. Keeps a single
// implementation of cell layout, thumbnail + fallback, single-selection and
// confirm-button wiring so the two modals share one code path and one style.

/**
 * @typedef {{
 *   key: string,
 *   thumbUrl?: string,
 *   name?: string,
 *   title?: string,
 *   payload: unknown,
 * }} ImagePickerItem
 */

/**
 * Render selectable image cells into `grid`. Single-select; toggles
 * `confirmBtn.disabled` and calls `onSelect(payload)` on selection.
 * @param {{
 *   grid: HTMLElement,
 *   items: ImagePickerItem[],
 *   confirmBtn?: HTMLButtonElement | null,
 *   emptyText?: string,
 *   onSelect?: (payload: unknown) => void,
 * }} options
 */
export function renderSelectableImageGrid({ grid, items, confirmBtn = null, emptyText = '暂无图片', onSelect }) {
  if (!grid) return;
  grid.empty();
  grid.removeClass('is-loading');

  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) {
    grid.createDiv({ cls: 'wechat-material-empty', text: emptyText });
    if (confirmBtn) confirmBtn.disabled = true;
    return;
  }

  for (const item of list) {
    const name = item && typeof item.name === 'string' && item.name ? item.name : '未命名图片';
    const cell = grid.createDiv({ cls: 'wechat-material-cell' });
    cell.setAttribute('role', 'button');
    cell.setAttribute('tabindex', '0');
    cell.setAttribute('title', (item && item.title) || name);

    const thumbUrl = item && typeof item.thumbUrl === 'string' ? item.thumbUrl : '';
    if (thumbUrl) {
      const img = cell.createEl('img', { attr: { src: thumbUrl, loading: 'lazy', alt: name } });
      img.onerror = () => {
        img.remove();
        cell.createDiv({ cls: 'wechat-material-thumb-fallback', text: name });
      };
    } else {
      cell.createDiv({ cls: 'wechat-material-thumb-fallback', text: name });
    }
    cell.createDiv({ cls: 'wechat-material-name', text: name });

    const selectCell = () => {
      grid.querySelectorAll('.wechat-material-cell.is-selected').forEach((el) => el.removeClass('is-selected'));
      cell.addClass('is-selected');
      if (confirmBtn) confirmBtn.disabled = false;
      if (typeof onSelect === 'function') onSelect(item ? item.payload : null);
    };
    cell.onclick = selectCell;
    cell.onkeydown = (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectCell();
      }
    };
  }
}
