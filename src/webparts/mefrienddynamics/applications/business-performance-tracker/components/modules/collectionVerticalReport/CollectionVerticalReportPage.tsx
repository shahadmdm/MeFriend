import * as React from 'react';



import { PageContainer } from '../../../../../shared/components/pageContainer/PageContainer';

import { Dropdown } from '../../../../../shared/components/dropdowns/Dropdown';

import { Button } from '../../../../../shared/components/buttons/Button';

import { AmountDisplay } from '../../../../../shared/components/amountDisplay/AmountDisplay';

import { getUserFriendlyError } from '../../../../../shared/api/apiErrorHandler';



import { collectionVerticalReportModuleConfig } from '../../../config/modules/collectionVerticalReportModuleConfig';



import {

  collectionReportMonthOptions,

  collectionReportCriteriaOptions,

  getCollectionReportYearOptions

} from '../../../config/modules/collectionReportFilterConfig';



import type {

  CollectionReportCriteria

} from '../../../config/modules/collectionReportFilterConfig';



import type { ITargetListItem } from '../../../models/targets';

import type { IVerticalListItem } from '../../../models/verticals';



import type { TargetService } from '../../../services/targets/targetService';

import type { VerticalService } from '../../../services/verticals/verticalService';

import type { CollectionVerticalReportApiService } from '../../../services/businessReport/collectionVerticalReportApiService';

import type { IBusinessReportTotal } from '../../../services/businessReport/businessReportMapper';

import { getBusinessReportCell } from '../../../services/businessReport/businessReportMapper';



import {

  bcCompanies,

  getBcCompanyLabel

} from '../../../../bc-extension/config/bcCompanies';



import styles from './CollectionVerticalReportPage.module.scss';





export interface ICollectionVerticalReportPageProps {

  targetService: TargetService;

  verticalService: VerticalService;

  collectionVerticalReportApiService?: CollectionVerticalReportApiService;

  selectedCompanyId?: string;
  
}



interface IReportSelection {

  month: string;

  year: string;

  criteria: CollectionReportCriteria;

  companyId?: string;

}



interface IReportRow {

  key: string;

  name: string;

  code: string;

  companyId: string;

  targetsByVertical: Map<number, ITargetListItem>;

}



// Compact table sizing: allow more business verticals to fit without scrolling.

const numberColumnWidth = 44;

const targetColumnWidth = 116;

const businessColumnWidth = 122;

const percentageColumnWidth = 72;

const verticalGroupWidth =

  targetColumnWidth + businessColumnWidth + percentageColumnWidth;



// Presentation only. Keep achievement calculations unchanged.

const renderAchievement = (percentage: number | undefined): React.ReactNode => {

  if (percentage === undefined || !Number.isFinite(percentage)) {

    return <span className={styles.fallback}>—</span>;

  }



  return (

    <span className={styles.achievementValue}>

      {percentage.toFixed(1)}%

    </span>

  );

};



const normalizeCode = (code: string): string =>

  code.trim().toUpperCase();



const getCompanyDisplayName = (companyId: string): string => {

  const company = bcCompanies.find(

    item =>

      item.id.toLowerCase() === companyId.trim().toLowerCase()

  );



  return company

    ? getBcCompanyLabel(company)

    : `Unknown Company (${companyId || 'Missing ID'})`;

};



const buildReportRows = (

  targets: readonly ITargetListItem[]

): readonly IReportRow[] => {

  const grouped = new Map<string, IReportRow>();



  for (const item of targets) {

    // Never merge targets belonging to different companies.

    const key = JSON.stringify([

      item.companyId,

      item.targetType,

      normalizeCode(item.targetCode)

    ]);



    let row = grouped.get(key);



    if (!row) {

      row = {

        key,

        name: item.targetName,

        code: item.targetCode,

        companyId: item.companyId,

        targetsByVertical: new Map<number, ITargetListItem>()

      };



      grouped.set(key, row);

    }



    row.targetsByVertical.set(item.verticalId, item);

  }



  return Array.from(grouped.values()).sort(

    (first, second) =>

      first.name.localeCompare(

        second.name,

        undefined,

        { sensitivity: 'base' }

      ) ||

      first.companyId.localeCompare(second.companyId) ||

      first.code.localeCompare(second.code)

  );

};



export const CollectionVerticalReportPage:

  React.FC<ICollectionVerticalReportPageProps> = ({

    targetService,

    verticalService,

    collectionVerticalReportApiService,

    selectedCompanyId

  }) => {

    const today = new Date();

    const currentMonth = String(today.getMonth() + 1);

    const currentYear = today.getFullYear();



    const [month, setMonth] =

      React.useState<string>(currentMonth);



    const [year, setYear] =

      React.useState<string>(String(currentYear));



    const [criteria, setCriteria] =

      React.useState<CollectionReportCriteria>('Salesperson');



    const [appliedSelection, setAppliedSelection] =

      React.useState<IReportSelection | undefined>();



    const [reportTargets, setReportTargets] =

      React.useState<readonly ITargetListItem[]>([]);



    const [reportVerticals, setReportVerticals] =

      React.useState<readonly IVerticalListItem[]>([]);



    const [reportTotals, setReportTotals] =

      React.useState<readonly IBusinessReportTotal[]>([]);



    const [loading, setLoading] =

      React.useState<boolean>(false);



    const [error, setError] =

      React.useState<string | undefined>();



    // Invalidate in-flight requests when the selected company

    // changes or this page is unmounted.

    const reportRequestId = React.useRef<number>(0);



    React.useEffect(() => {

      setAppliedSelection(undefined);

      setReportTargets([]);

      setReportVerticals([]);

      setReportTotals([]);

      setError(undefined);

      setLoading(false);



      return () => {

        reportRequestId.current += 1;

      };

    }, [selectedCompanyId]);



    const yearOptions = React.useMemo(

      () => getCollectionReportYearOptions(

        [

          currentYear - 2,

          currentYear - 1,

          currentYear

        ],

        currentYear

      ),

      [currentYear]

    );



    const handleSubmit = React.useCallback(

      async (): Promise<void> => {

        const requestId = ++reportRequestId.current;

        const selection: IReportSelection = {

          month,

          year,

          criteria,

          companyId: selectedCompanyId

        };



        setAppliedSelection(selection);

        setReportTargets([]);

        setReportVerticals([]);

        setReportTotals([]);

        setError(undefined);

        setLoading(true);



        try {

          const [targets, verticals, totals] = await Promise.all([

            selectedCompanyId === undefined

              ? targetService.getTargets()

              : targetService.getTargetsByCompany(selectedCompanyId),

            selectedCompanyId === undefined

              ? verticalService.getVerticals()

              : verticalService.getVerticalsByCompany(selectedCompanyId),

            selectedCompanyId !== undefined && collectionVerticalReportApiService

              ? collectionVerticalReportApiService.getBusinessReportTotals({

                  companyId: selectedCompanyId,

                  month: Number(selection.month),

                  year: Number(selection.year),

                  targetType: selection.criteria

                })

              : Promise.resolve([] as readonly IBusinessReportTotal[])

          ]);



          if (requestId !== reportRequestId.current) {

            return;

          }



          const selectedMonth = Number(selection.month);

          const selectedYear = Number(selection.year);



          const filteredTargets = targets.filter(item =>

            (selectedCompanyId === undefined ||

              item.companyId === selectedCompanyId) &&

            item.targetMonth === selectedMonth &&

            item.targetYear === selectedYear &&

            item.targetType === selection.criteria

          );



          const companyIds = new Set(

            filteredTargets.map(item => item.companyId)

          );



          const referencedVerticalIds = new Set(

            filteredTargets.map(item => item.verticalId)

          );



          // Retain active verticals belonging to the reporting

          // company and inactive verticals referenced by its targets.

          // When no company is selected (transitional legacy mode),

          // preserve the report's existing multi-company behavior.

          const applicableVerticals = verticals.filter(

            vertical =>

              (selectedCompanyId === undefined ||

                vertical.companyId === selectedCompanyId) &&

              companyIds.has(vertical.companyId) &&

              (

                vertical.isActive ||

                referencedVerticalIds.has(vertical.id)

              )

          );



          const matchedVerticalIds = new Set(

            applicableVerticals.map(vertical => vertical.id)

          );



          // Do not silently hide targets whose vertical

          // reference is missing or belongs to another company.

          const missingVerticals = new Map<

            number,

            IVerticalListItem

          >();



          for (const target of filteredTargets) {

            if (!matchedVerticalIds.has(target.verticalId)) {

              missingVerticals.set(target.verticalId, {

                id: target.verticalId,

                companyId: target.companyId,

                verticalName:

                  `Unknown Vertical (ID ${target.verticalId})`,

                isActive: false,

                verticalUniqueKey: ''

              });

            }

          }



          const sortedVerticals = [

            ...applicableVerticals,

            ...Array.from(missingVerticals.values())

          ].sort(

            (first, second) =>

              first.verticalName.localeCompare(

                second.verticalName,

                undefined,

                { sensitivity: 'base' }

              ) ||

              first.companyId.localeCompare(second.companyId)

          );



          // Validate every displayed target/vertical combination once.

          // Mixed currencies must be reported as an error, not added.

          for (const target of filteredTargets) {

            const vertical = sortedVerticals.find(item =>

              item.id === target.verticalId &&

              item.companyId === target.companyId

            );

            if (vertical && collectionVerticalReportApiService) {

              getBusinessReportCell(target, vertical, totals);

            }

          }



          if (requestId === reportRequestId.current) {

            setReportTargets(filteredTargets);

            setReportVerticals(sortedVerticals);

            setReportTotals(totals);

          }

        } catch (loadError) {

          if (requestId === reportRequestId.current) {

            setReportTargets([]);

            setReportVerticals([]);

            setReportTotals([]);

            setError(getUserFriendlyError(loadError));

          }

        } finally {

          if (requestId === reportRequestId.current) {

            setLoading(false);

          }

        }

      },

      [month, year, criteria, targetService, verticalService, collectionVerticalReportApiService, selectedCompanyId]

    );



    const reportRows = React.useMemo(

      () => buildReportRows(

        selectedCompanyId === undefined

          ? reportTargets

          : reportTargets.filter(

              item => item.companyId === selectedCompanyId

            )

      ),

      [reportTargets, selectedCompanyId]

    );



    // Display only verticals with an assigned target in this report.

    // Keep other employees' empty cells in the desktop comparison table.

    const displayVerticals = React.useMemo(

      () => reportVerticals.filter(vertical =>

        reportRows.some(row =>

          row.companyId === vertical.companyId &&

          row.targetsByVertical.has(vertical.id)

        )

      ),

      [reportVerticals, reportRows]

    );



    // Never show a report generated for the previous company.

    const visibleSelection =

      appliedSelection?.companyId === selectedCompanyId

        ? appliedSelection

        : undefined;



    // Size the identity column to the report's longest name, within compact

    // limits. Long names can wrap rather than forcing horizontal scrolling.

    const longestNameLength = reportRows.reduce(

      (maxLength, row) => Math.max(maxLength, row.name.trim().length),

      0

    );

    const isSalespersonReport = visibleSelection?.criteria === 'Salesperson';

    const identityColumnWidth = Math.min(

      isSalespersonReport ? 250 : 205,

      Math.max(

        isSalespersonReport ? 180 : 150,

        Math.ceil(longestNameLength * 7.4 + 28)

      )

    );

    const tableWidth =

      numberColumnWidth + identityColumnWidth +

      displayVerticals.length * verticalGroupWidth;



    const selectedMonthName = visibleSelection

      ? collectionReportMonthOptions.find(

          option => option.value === visibleSelection.month

        )?.text

      : undefined;



    const getVerticalHeader = (

      vertical: IVerticalListItem

    ): React.ReactNode => {

      const duplicateNameCount = displayVerticals.filter(

        item =>

          item.verticalName.trim().toLowerCase() ===

          vertical.verticalName.trim().toLowerCase()

      ).length;



      return (

        <>

          <span>{vertical.verticalName}</span>



          {duplicateNameCount > 1 ? (

            <div

              style={{

                fontSize: 11,

                fontWeight: 400,

                marginTop: 4,

                whiteSpace: 'normal',

                overflowWrap: 'anywhere'

              }}

            >

            Company: {getCompanyDisplayName(vertical.companyId)}

            </div>

          ) : null}

        </>

      );

    };



    return (

      <PageContainer

        title={collectionVerticalReportModuleConfig.title}

        description={collectionVerticalReportModuleConfig.description}

      >

        <div className={styles.reportLayout}>

          <section className={styles.filterPanel} aria-label="Report filters">

            <div className={styles.filterIntro}>

              <div>

                <h3 className={styles.filterTitle}>Report filters</h3>

                <p className={styles.filterDescription}>

                  Choose a reporting period and view performance by unit or salesperson.

                </p>

              </div>

            </div>

            <div className={styles.filterGrid}>

              <Dropdown

                label="Month"

                value={month}

                options={collectionReportMonthOptions}

                required

                onChange={value => {

                  if (typeof value === 'string') {

                    setMonth(value);

                  }

                }}

              />



              <Dropdown

                label="Year"

                value={year}

                options={yearOptions}

                required

                onChange={value => {

                  if (typeof value === 'string') {

                    setYear(value);

                  }

                }}

              />



              <Dropdown

                label="Criteria"

                value={criteria}

                options={collectionReportCriteriaOptions}

                required

                onChange={value => {

                  if (value === 'Unit' || value === 'Salesperson') {

                    setCriteria(value);

                  }

                }}

              />



              <div className={styles.submitControl}>

                <Button

                  label="Submit"

                  variant="primary"

                  loading={loading}

                  disabled={loading}

                  onClick={() => {

                    handleSubmit().catch(() => undefined);

                  }}

                />

              </div>

            </div>

          </section>



          {visibleSelection ? (

            <section className={styles.reportView} aria-label="Business report results">

              <div className={styles.reportHeader}>

                <div>

                  <p className={styles.reportEyebrow}>PERFORMANCE OVERVIEW</p>

                  <h3 className={styles.reportTitle}>

                    {visibleSelection.criteria} Business Report

                  </h3>

                  <p className={styles.reportPeriod}>

                    Performance against monthly targets, grouped by business vertical.

                  </p>

                </div>

                <div className={styles.periodBadge}>

                  {selectedMonthName} {visibleSelection.year}

                </div>

              </div>



              {!loading && !error && reportRows.length > 0 ? (

                <div className={styles.overviewGrid} aria-label="Report overview">

                  <div className={styles.overviewItem}>

                    <span className={styles.overviewLabel}>

                      {visibleSelection.criteria === 'Unit' ? 'Units' : 'Salespersons'}

                    </span>

                    <strong className={styles.overviewValue}>{reportRows.length}</strong>

                  </div>

                  <div className={styles.overviewItem}>

                    <span className={styles.overviewLabel}>Verticals with targets</span>

                    <strong className={styles.overviewValue}>{displayVerticals.length}</strong>

                  </div>

                  <div className={styles.overviewItem}>

                    <span className={styles.overviewLabel}>Business data</span>

                    <strong className={styles.overviewText}>

                      {collectionVerticalReportApiService ? 'Business Central' : 'Not connected'}

                    </strong>

                  </div>

                </div>

              ) : null}



              <div className={styles.reportNotice} role="note">

                <span className={styles.noticeMarker} aria-hidden="true">i</span>

                <span>

                  Vertical names and monthly targets are retrieved from SharePoint.

                  {collectionVerticalReportApiService

                    ? ' Business values use Business Central posted invoice lines (provisional calculation, local demo only).'

                    : ' Business values and achievement percentages are pending API connection.'}

                </span>

              </div>



              {loading ? (

                <div className={styles.reportState} role="status">

                  Loading targets, verticals and Business amounts...

                </div>

              ) : error ? (

                <div

                  className={`${styles.reportState} ${styles.reportError}`}

                  role="alert"

                >

                  {error}

                </div>

              ) : reportRows.length === 0 ? (

                <div className={styles.reportState}>

                  No targets found for the selected Month, Year and Criteria.

                </div>

              ) : (

                <>

                  <div className={styles.tableShell}>

                    <div className={styles.tableToolbar}>

                      <div className={styles.tableToolbarTitle}>

                        Detailed performance

                        <span className={styles.tableRowCount}>{reportRows.length} rows</span>

                      </div>

                      {displayVerticals.length > 3 ? (

                        <span className={styles.scrollHint}>

                          Scroll horizontally for more verticals ↔

                        </span>

                      ) : null}

                    </div>

                    <div

                      className={styles.tableScroll}

                      tabIndex={0}

                      role="region"

                      aria-label="Scroll business report table horizontally"

                    >

                      <table

                        className={styles.reportTable}

                        style={{ minWidth: tableWidth }}

                      >

                        <caption className={styles.srOnly}>

                          {visibleSelection.criteria} Business Report for {selectedMonthName} {visibleSelection.year}

                        </caption>

                        <colgroup>

                          <col style={{ width: numberColumnWidth }} />

                          <col style={{ width: identityColumnWidth }} />

                          {displayVerticals.map(vertical => (

                            <React.Fragment key={vertical.id}>

                              <col style={{ width: targetColumnWidth }} />

                              <col style={{ width: businessColumnWidth }} />

                              <col style={{ width: percentageColumnWidth }} />

                            </React.Fragment>

                          ))}

                        </colgroup>



                        <thead>

                          <tr>

                            <th

                              className={styles.stickyNumber}

                              rowSpan={2}

                              scope="col"

                            >

                              No.

                            </th>

                            <th

                              className={styles.stickyIdentity}

                              rowSpan={2}

                              scope="col"

                            >

                              {visibleSelection.criteria}

                            </th>

                            {displayVerticals.map(vertical => (

                              <th

                                className={styles.verticalHeader}

                                colSpan={3}

                                key={vertical.id}

                                scope="colgroup"

                              >

                                {getVerticalHeader(vertical)}

                              </th>

                            ))}

                          </tr>

                          <tr>

                            {displayVerticals.map(vertical => (

                              <React.Fragment key={vertical.id}>

                                <th className={styles.metricHeader} scope="col">

                                  Target

                                </th>

                                <th className={`${styles.metricHeader} ${styles.businessHeading}`} scope="col">

                                  Business

                                </th>

                                <th className={styles.metricHeader} scope="col">

                                  %

                                </th>

                              </React.Fragment>

                            ))}

                          </tr>

                        </thead>



                        <tbody>

                          {reportRows.map((row, index) => (

                            <tr key={row.key}>

                              <td className={styles.stickyNumber}>

                                {index + 1}

                              </td>

                              <td className={styles.stickyIdentity}>

                                <div className={styles.identityName}>

                                  {row.name}

                                </div>

                                <div className={styles.identityCode}>

                                  Code: {row.code}

                                </div>

                                {selectedCompanyId === undefined ? (

                                  <div className={styles.identityCode}>

                                    Company: {getCompanyDisplayName(row.companyId)}

                                  </div>

                                ) : null}

                              </td>

                              {displayVerticals.map(vertical => {

                                const target =

                                  row.companyId === vertical.companyId

                                    ? row.targetsByVertical.get(vertical.id)

                                    : undefined;

                                const businessCell = target && collectionVerticalReportApiService

                                  ? getBusinessReportCell(target, vertical, reportTotals)

                                  : undefined;



                                return (

                                  <React.Fragment key={vertical.id}>

                                    <td className={styles.metricCell}>

                                      {target ? (

                                        <>

                                          <AmountDisplay amount={target.targetAmount} />

                                          {!target.isActive ? (

                                            <div className={styles.inactiveLabel}>

                                              Inactive

                                            </div>

                                          ) : null}

                                        </>

                                      ) : (

                                        <span className={styles.fallback}>—</span>

                                      )}

                                    </td>

                                    <td className={`${styles.metricCell} ${styles.businessCell}`}>

                                      {businessCell?.businessAmount !== undefined

                                        ? <AmountDisplay amount={businessCell.businessAmount} />

                                        : <span className={styles.fallback}>—</span>}

                                    </td>

                                    <td className={styles.metricCell}>

                                      {renderAchievement(businessCell?.achievementPercentage)}

                                    </td>

                                  </React.Fragment>

                                );

                              })}

                            </tr>

                          ))}

                        </tbody>

                      </table>

                    </div>

                  </div>



                  <div className={styles.mobileList}>

                    {reportRows.map((row, index) => (

                      <article className={styles.mobileCard} key={row.key}>

                        <div className={styles.mobileCardHeader}>

                          <div className={styles.mobileCardName}>

                            {row.name}

                          </div>

                          <div className={styles.mobileCardCode}>

                            No. {index + 1} · Code: {row.code}

                          </div>

                          {selectedCompanyId === undefined ? (

                            <div className={styles.mobileCardCode}>

                              Company: {getCompanyDisplayName(row.companyId)}

                            </div>

                          ) : null}

                        </div>



                        {displayVerticals

                          .filter(vertical =>

                            row.companyId === vertical.companyId &&

                            row.targetsByVertical.has(vertical.id)

                          )

                          .map(vertical => {

                            const target =

                              row.companyId === vertical.companyId

                                ? row.targetsByVertical.get(vertical.id)

                                : undefined;

                            const businessCell = target && collectionVerticalReportApiService

                              ? getBusinessReportCell(target, vertical, reportTotals)

                              : undefined;



                          return (

                            <div className={styles.mobileVertical} key={vertical.id}>

                              <div className={styles.mobileVerticalTitle}>

                                {getVerticalHeader(vertical)}

                              </div>

                              <div className={styles.mobileMetrics}>

                                <div className={styles.mobileMetric}>

                                  <span className={styles.mobileMetricLabel}>

                                    Target

                                  </span>

                                  <div className={styles.mobileMetricValue}>

                                    {target ? (

                                      <>

                                        <AmountDisplay amount={target.targetAmount} />

                                        {!target.isActive ? (

                                          <div className={styles.inactiveLabel}>

                                            Inactive

                                          </div>

                                        ) : null}

                                      </>

                                    ) : (

                                      <span className={styles.fallback}>—</span>

                                    )}

                                  </div>

                                </div>

                                <div className={styles.mobileMetric}>

                                  <span className={styles.mobileMetricLabel}>

                                    Business

                                  </span>

                                  <div className={styles.mobileMetricValue}>

                                    {businessCell?.businessAmount !== undefined

                                      ? <AmountDisplay amount={businessCell.businessAmount} />

                                      : <span className={styles.fallback}>—</span>}

                                  </div>

                                </div>

                                <div className={styles.mobileMetric}>

                                  <span className={styles.mobileMetricLabel}>

                                    %

                                  </span>

                                  <div className={styles.mobileMetricValue}>

                                    {renderAchievement(businessCell?.achievementPercentage)}

                                  </div>

                                </div>

                              </div>

                            </div>

                          );

                        })}

                      </article>

                    ))}

                  </div>

                </>

              )}

            </section>

          ) : (

            <div className={styles.emptyPrompt}>

              <span className={styles.emptyPromptSymbol} aria-hidden="true">▤</span>

              <strong>Ready to view performance?</strong>

              <span>Select Month, Year and Criteria, then click Submit to generate the Business Report.</span>

            </div>

          )}

        </div>

      </PageContainer>

    );

  };