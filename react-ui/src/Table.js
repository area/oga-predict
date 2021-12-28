// Table.js

import React from "react";
import { useTable, useSortBy } from "react-table";

export default function Table({ loading, columns, data, getRowProps = () => ({})}) {
  // Use the useTable Hook to send the columns and data to build the table
  const {
    getTableProps, // table props from react-table
    getTableBodyProps, // table body props from react-table
    headerGroups, // headerGroups, if your table has groupings
    rows, // rows for the table based on the data passed
    prepareRow, // Prepare the row (this function needs to be called for each row before getting the row props)
  } = useTable({
    columns,
    data,
    getRowProps,
  }, useSortBy);

  /*
    Render the UI for your table
    - react-table doesn't have UI, it's headless. We just need to put the react-table props from the Hooks, and it will do its magic automatically
  */
  return (
    <div>
    <table className="table-dark table-sm table-striped" {...getTableProps()}>
      <thead>
        {headerGroups.map(headerGroup => (
          <tr {...headerGroup.getHeaderGroupProps()}>
            {headerGroup.headers.map(column => (
              <th {...column.getHeaderProps(column.getSortByToggleProps())}>{column.render("Header")}</th>
            ))}
          </tr>
        ))}
      </thead>

      {!loading &&
      <tbody {...getTableBodyProps()}>
        {rows.map((row, i) => {
          prepareRow(row);
          return (
            <tr {...row.getRowProps(getRowProps(row))}>
              {row.cells.map(cell => {
                return <td {...cell.getCellProps()}>{cell.render("Cell")}</td>;
              })}
            </tr>
          );
        })}
      </tbody>
      }
    </table>
    {loading &&
      <div className="text-center">
        <div className="spinner-grow" role="status">
        <span className="sr-only"></span>
        </div>
      </div>
    }
    {data.length === 0 && <div>No data</div>}
    </div>
  );
}