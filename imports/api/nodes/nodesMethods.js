import { Nodes, Edges } from '../collections.js'
import { Meteor } from 'meteor/meteor'
import { bulkCollectionUpdate } from 'meteor/udondan:bulk-collection-update'

import { ValidatedMethod } from 'meteor/mdg:validated-method'
import { SimpleSchema } from 'meteor/aldeed:simple-schema'

import logger from '../../logger.js'

const NODE_ID_ONLY = new SimpleSchema({
  nodeId: Nodes.simpleSchema().schema('_id'),
}).validator({ clean: true, filter: false })

/**
* Create a single node
*
* @instance {ValidatedMethod}
* @param {Object} node the raw node data (generated by `MakeNode()`)
* @return {Object} the Node object as inserted in Mongo
*/
export const nodeCreate = new ValidatedMethod({
  name: 'node.create',
  validate: Nodes.schema.validator(),
  run({ node }) {
    return Nodes.insert( node )
  }
})

/**
* Delete a single node
*
* @instance {ValidatedMethod}
* @param {Object} node the raw node data (generated by `MakeNode()`)
* @return {Object} the Node object as inserted in Mongo
*/
export const nodeDelete = new ValidatedMethod({
  name: 'node.delete',
  validate: NODE_ID_ONLY,
  run({ nodeId }) {
    return Nodes.remove( nodeId )
  }
})

Meteor.methods( {

  batchInsertNodes( nodes ) {
    return Nodes.batchInsert( nodes )
  },

  mergeNodes( sourceId, targetId ) {
    const source = Nodes.findOne( {
      '_id': sourceId
    } )
    const target = Nodes.findOne( {
      '_id': targetId
    } )  // will be deleted

        // console.log("merging nodes")

        // tx.start( "merges nodes" )

        // find and replace all target node edges with source id
    Edges.find({
      'data.source': target.data.id
    }).forEach(function (edge) {
      Edges.update({
        '_id': edge._id
      },{
        $set: {
          'data.source': source.data.id
        }
            // },{
            //  tx: true
      })
    })

    Edges.find( {
      'data.target': target.data.id
    }).forEach( function ( edge ) {
      Edges.update({
        '_id': edge._id
      },{
        $set: {
          'data.target': source.data.id
        }

            // }, {
            //     tx: true
      })
    })

        // copy data of target into source (if missing)
        // TODO : node merger startegy

        //erase target
    Nodes.remove({ '_id': targetId })
        // , {
        //     tx: true
        // } )
        // tx.commit()
  },

  deleteNode( nodeId ) {
    const _id = Nodes.findOne( {
      'data.id': nodeId
    }, {
      '_id': 1
    } )._id
    Nodes.remove( {
      _id
    })
  },

  deleteNodeAndConnectedEdges( nodeId, edgesId ) {
    const _id = Nodes.findOne( {
      'data.id': nodeId
    }, {
      '_id': 1
    } )._id

        // tx.start( "delete node+neighborhood" )
    Nodes.remove( {
      _id
    })
    Edges.find( {
      'data.id': {
        '$in': edgesId
      }
    } ).forEach( function ( edge ) {
      Edges.remove( {
        '_id': edge._id
      })
    } )
        // tx.commit()
  },

  deleteNodesByTopogramId( topogramId ) {
    return Nodes.remove( {
      topogramId
    } )
  },

    //update coord in DB for a single node
  updateNodePosition( nodeId, position ) {
    const node = Nodes.findOne( {
      'data.id': nodeId
    } )
    Nodes.update( {
      _id: node._id
    }, {
      $set: {
        position
      }
    } )
  },


    // TODO : improve batch update of nodes
    // update coords in DB for bunch of nodes (useful to save topogram layout changes)
  updateNodesPositions( updatedNodes ) {

    const nodesPosition = {}
    updatedNodes.forEach(function (d) {
      nodesPosition[d._id] = d.position
      return d
    })

    const nodes = Nodes.find({
      '_id' : {
        '$in': updatedNodes.map(function (d) {return d._id})
      }
    }).fetch().map(function (d) { // update data
      d.position = nodesPosition[d._id]
      return d
        //  = updatedNodes
    })

    bulkCollectionUpdate(Nodes, nodes, {
      primaryKey : '_id',
      callback() {
        logger.log('Nodes positions updated.')
      }
    })
  },

  lockNode( nodeId, position ) {
    const node = Nodes.findOne( {
      'data.id': nodeId
    } )
    const locked = node.locked ? false : true
    Nodes.update( {
      _id: node._id
    }, {
      $set: {
        locked,
        position
      }
    } )
  },

    // TODO: pass _id instead of data.id
  starNode( nodeId ) {
    const node = Nodes.findOne( {
      'data.id': nodeId
    })
    const starred = node.data.starred ? false : true
    Nodes.update({
      _id: node._id
    }, {
      $set: {
        'data.starred': starred
      }
    })

  },

  fetchNodes( edges ) {
    return edges.map( function ( e ) {
      return {
        source: e.data.source,
        target: e.data.target
      }
    })
            .reduce( function ( map, d ) {
              map[ d.id ] = map[ d.id ] || d
              map[ d.id ].count = ( map[ d.id ].count || 0 ) + 1
              return map
            }, {} )
  }
} )
