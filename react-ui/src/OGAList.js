import React, { useCallback, useEffect, useState, useMemo } from 'react';
import Table from './Table'
import {
  Link
} from "react-router-dom";

function OGAList(props) {

  const [loadingData, setLoadingData] = useState(true);
  const columns = useMemo(() => [
    {
      accessor: "rank",
      Cell: ({ value, row }) => {
        return (<React.Fragment><h1>{value}</h1></React.Fragment>)
      }

    },
    {
      accessor: "cover",
      Cell: ({ value, row }) => {
        return (<React.Fragment><img style={{"marginRight":"20px"}} src={row.original.coverurl} alt="Cover" /></React.Fragment>)
      }
    },
    {
      accessor: "name",
      Cell: ({ value, row }) => {
        return (<React.Fragment>{value}{props.isAdmin ? <React.Fragment> | <Link to={`/game/edit/${row.original.gameid}`}>Edit</Link></React.Fragment> : ""}</React.Fragment>)
      }
    },
    { 
      accessor: "episode",
      Cell: ({ value, row }) => {
        return ( <a href={row.original.episodeurl}>Episode {row.original.episodeid}</a>)
      }

    }
  ]);

  const [data, setData] = useState([]);

  const fetchData = useCallback(() => {
    fetch("/api/games")
      .then(response => {
        if (!response.ok) {
          throw new Error(`status ${response.status}`);
        }
        return response.json();
      })
      .then(json => {
        setData(json.filter(game => game.rank > 0))
      }).catch(e => {
        console.log(e);
      })
  });

  useEffect(() => {
    fetchData();
  }, []);
  return ( <React.Fragment><div className="text-center"><h2>The List</h2></div> <Table columns={columns} data={data} /></React.Fragment>)
}

export default OGAList;