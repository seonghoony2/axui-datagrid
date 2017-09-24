import * as act from '../actions';
import {List, Map} from 'immutable';
import {each, extend, extendOwn, isArray, isNumber, isObject, isString} from "underscore";
// import {mouseEventNames} from '../_inc/preference';
import * as UTIL from '../_inc/utils';

// 초기 상태
const initialState = Map({
  receivedList: List([]),
  deletedList: List([]),
  list: List([]),
  page: Map({}),
  sortInfo: Map({}),
  scrollLeft: 0,
  scrollTop: 0,
  columns: List([]),
  colGroup: List([]),
  footSumColumns: List([]),
  bodyGrouping: List([]),
  focusedColumn: Map({}), // 그리드 바디의 포커스된 셀 정보
  selectedColumn: Map({}), // 그리드 바디의 선택된 셀 정보
  isInlineEditing: false,
  inlineEditing: Map({}),
  listIndexMap: Map({}), // tree데이터 사용시 데이터 인덱싱 맵
  headerTable: Map({}),
  leftHeaderData: Map({}),
  headerData: Map({}),
  rightHeaderData: Map({}),
  bodyRowTable: Map({}),
  leftBodyRowData: Map({}),
  bodyRowData: Map({}),
  rightBodyRowData: Map({}),
  bodyRowMap: Map({}),
  bodyGroupingTable: Map({}),
  leftBodyGroupingData: Map({}),
  bodyGroupingData: Map({}),
  rightBodyGroupingData: Map({}),
  bodyGroupingMap: Map({}),
  footSumTable: Map({}), // footSum의 출력레이아웃
  leftFootSumData: Map({}), // frozenColumnIndex 를 기준으로 나누어진 출력 레이아웃 왼쪽
  footSumData: Map({}), // frozenColumnIndex 를 기준으로 나누어진 출력 레이아웃 오른쪽
  options: Map({
    frozenColumnIndex: 0,
    frozenRowIndex: 0,
    showLineNumber: false,
    showRowSelector: false,
    multipleSelect: true,
    columnMinWidth: 100,
    lineNumberColumnWidth: 30,
    rowSelectorColumnWidth: 26,
    sortable: undefined,
    remoteSort: false,
    header: {
      display: true,
      align: false,
      columnHeight: 26,
      columnPadding: 3,
      columnBorderWidth: 1,
      selector: true
    },
    body: {
      align: false,
      columnHeight: 26,
      columnPadding: 3,
      columnBorderWidth: 1,
      grouping: false,
      mergeCells: false
    },
    page: {
      height: 25,
      display: true,
      statusDisplay: true,
      navigationItemCount: 5
    },
    scroller: {
      size: 15,
      barMinSize: 15,
      trackPadding: 4
    },
    columnKeys: {
      selected: '__selected__',
      modified: '__modified__',
      deleted: '__deleted__',
      disableSelection: '__disable_selection__'
    },
    tree: {
      use: false,
      hashDigit: 8,
      indentWidth: 10,
      arrowWidth: 15,
      iconWidth: 18,
      icons: {
        openedArrow: '▾',
        collapsedArrow: '▸',
        groupIcon: '⊚',
        collapsedGroupIcon: '⊚',
        itemIcon: '⊙'
      },
      columnKeys: {
        parentKey: "pid",
        selfKey: "id",
        collapse: "collapse",
        hidden: "hidden",
        parentHash: "__hp__",
        selfHash: "__hs__",
        children: "__children__",
        depth: "__depth__",
      }
    },
    footSum: false
  })
});

/*
this.xvar = {
  bodyTrHeight: 0, // 한줄의 높이
  scrollContentWidth: 0, // 스크롤 될 내용물의 너비 (스크롤 될 내용물 : panel['body-scroll'] 안에 컬럼이 있는)
  scrollContentHeight: 0, // 스크롤 된 내용물의 높이
  scrollTimer: null
};
*/

// 리듀서 함수 정의
const grid = (state = initialState, action) => {
  const processor = {
    [act.INIT]: () => { // 그리드 데이터 초기화
      let headerTable, bodyRowTable, bodyRowMap, colGroup, colGroupMap, footSumColumns, footSumTable, bodyGrouping, bodyGroupingTable, sortInfo;
      let list; // 그리드에 표현할 목록
      let options = state.get('options').toJS();

      each(action.options, function (v, k) {
        options[k] = (isObject(v)) ? extendOwn(options[k], v) : v;
      });

      headerTable = UTIL.makeHeaderTable(action.columns, options);
      bodyRowTable = UTIL.makeBodyRowTable(action.columns, options);
      bodyRowMap = UTIL.makeBodyRowMap(bodyRowTable, options);

      options.frozenColumnIndex = options.frozenColumnIndex || 0;
      // 한줄의 높이 계산 (한줄이 여러줄로 구성되었다면 높이를 늘려야 하니까);
      options.bodyTrHeight = bodyRowTable.rows.length * options.body.columnHeight;

      // colGroupMap
      {
        colGroupMap = {};
        for (let r = 0, rl = headerTable.rows.length; r < rl; r++) {
          let row = headerTable.rows[r];
          for (let c = 0, cl = row.cols.length; c < cl; c++) {
            colGroupMap[row.cols[c].colIndex] = extend({}, row.cols[c]);
          }
        }

        colGroup = [];
        each(colGroupMap, function (v, k) {
          colGroup.push(v);
        });
      }

      // footSum
      {
        footSumColumns = [];
        footSumTable = {};

        if (isArray(options.footSum)) {
          footSumColumns = options.footSum;
          footSumTable = UTIL.makeFootSumTable(footSumColumns, colGroup, options);
        }
      }

      // grouping info
      if (options.body.grouping) {
        if ("by" in options.body.grouping && "columns" in options.body.grouping) {
          bodyGrouping = {
            by: options.body.grouping.by,
            columns: options.body.grouping.columns
          };
          bodyGroupingTable = UTIL.makeBodyGroupingTable(bodyGrouping.columns, colGroup, options);
          sortInfo = (() => {
            let sortInfo = {};
            for (let k = 0, kl = bodyGrouping.by.length; k < kl; k++) {
              sortInfo[bodyGrouping.by[k]] = {
                orderBy: "asc",
                seq: k,
                fixed: true
              };
              for (let c = 0, cl = colGroup.length; c < cl; c++) {
                if (colGroup[c].key === bodyGrouping.by[k]) {
                  colGroup[c].sort = "asc";
                  colGroup[c].sortFixed = true;
                }
              }
            }
            return sortInfo;
          })();
        } else {
          options.body.grouping = false;
        }
      }

      // 전달받은 리스트 중에 출력할 리스트를 필터링
      list = action.receivedList.filter(function (item) {
        if (item) {
          if (item[options.columnKeys.deleted]) {
            return false;
          } else {
            return true;
          }
        }
        return false;
      });

      return state
        .set('columns', List(action.columns))
        .set('headerTable', Map(headerTable))
        .set('bodyRowTable', Map(bodyRowTable))
        .set('bodyRowMap', Map(bodyRowMap))
        .set('colGroup', List(colGroup))
        .set('colGroupMap', Map(colGroupMap))
        .set('footSumColumns', Map(footSumColumns))
        .set('footSumTable', Map(footSumTable))
        .set('bodyGrouping', Map(bodyGrouping))
        .set('bodyGroupingTable', Map(bodyGroupingTable))
        .set('sortInfo', Map(sortInfo))
        .set('receivedList', List(action.receivedList))
        .set('list', List(list))
        .set('page', isObject(action.page) ? Map(action.page) : false)
        .set('options', Map(options));
    },

    // 필요 액션들
    // alignGrid
    [act.DID_MOUNT]: () => {
      const elWidth = action.containerDOM.getBoundingClientRect().width;
      let options = state.get('options').toJS();
      let contWidth = elWidth - (() => {
        let width = 0;
        if (options.showLineNumber) width += options.lineNumberColumnWidth;
        if (options.showRowSelector) width += options.rowSelectorColumnWidth;
        width += options.scroller.size;
        return width;
      })();

      let colGroup = state.get("colGroup").toJS();
      colGroup = UTIL.setColGroupWidth(colGroup, {width: contWidth}, options);

      return state
        .set('colGroup', colGroup);
    },

    [act.SET_DATA]: () => {
      return state
        .set('receivedList', List(action.receivedList))
        .set('page', Map(action.page));
    },

    [act.UPDATE_SCROLL]: () => {
      if (isNumber(action.scrollLeft) || isString(action.scrollLeft)) {
        state = state.set('scrollLeft', action.scrollLeft);
      }
      if (isNumber(action.scrollTop) || isString(action.scrollTop)) {
        state = state.set('scrollTop', action.scrollTop);
      }

      return state;
    },
    [act.ALIGN]: () => {

      return state;
    }
  };

  if (action.type in processor) {
    return processor[action.type]();
  } else {
    return state;
  }
};

export default grid;