var _ = require('lodash');
var path = require('canonical-path');

module.exports = {
  name: 'components-generate',
  description: 'Transform the components into a renderable data structure',
  runAfter: ['api-docs'],
  runBefore: ['render-docs'],
  process: function(docs, config, otherDocs) {
    var options = config.get('processing.componentsGenerate', {});
    var repositoryUrl = config.get('source.repository');
    var projectPath = config.get('source.projectPath');

    var componentOutputFolder = options.componentOutputFolder;
    var docOutputFolder = path.join(componentOutputFolder, options.docSubFolder);

    var components = [];
    var renderedDocs = [];

    docs = docs.concat(otherDocs);

    var processors = {
      demo: processDemos,
      readme: processDocs,
      directive: processDocs,
      service: processDocs,
      object: processDocs,
    };

    _(docs)
      .groupBy('componentId')
      .each(function(componentDocs, componentId) {
        var component = {
          id: componentId,
          name: componentDocs[0].componentName,
          docs: []
        };

        if (!_.find(componentDocs, { docType: 'demo' })) {
          return;
        }
        _(componentDocs)
          .omit({ docType: 'module' })
          .groupBy('docType')
          .each(function(docs, docType) {
            if (processors[docType]) {
              processors[docType](component, docType, docs);
            }
          });

        component.docs = component.docs.sort(function(doc) {
          return doc.docType === 'readme' ? -1 : 1;
        });

        component.template = 'component.template.html';
        component.outputPath = path.join(
          _.template(componentOutputFolder, { component: component }),
          'index.html'
        );

        renderedDocs.push(component);
        components.push(component);
      });

    renderedDocs.push({
      template: 'components-data.template.js',
      outputPath: 'js/components-data.js',
      components: components
    });

    return renderedDocs;

    function processDemos(component, docType, demoDocs) {
      component.demos = _(demoDocs)
        .groupBy('id')
        .map(function(demoDocs, demoId) {
          var demo = {};
          demo.id = demoId;
          demo.name = demoDocs[0].name;
          demo.docType = 'demo';

          var outputFolder = _.template(docOutputFolder, {
            component: component, doc: demo
          });
          
          var indexDoc = _(demoDocs)
            .remove({ basePath: 'index.html' })
            .first();

          demo.files = _.map(demoDocs, generateDemoFile);
          demo.indexFile = generateDemoFile(indexDoc);
          demo.indexFile.js = _.filter(demo.files, { fileType: 'js' });
          demo.indexFile.css = _.filter(demo.files, { fileType: 'css' });

          renderedDocs = renderedDocs
            .concat(demo.indexFile)
            .concat(demo.files);

          return demo;

          function generateDemoFile(fromDoc) {
            return _.assign({}, fromDoc, {
              template: fromDoc.basePath === 'index.html' ? 
                'demo/template.index.html' :
                'demo/template.file',
              outputPath: path.join(outputFolder, fromDoc.basePath),
            });
          }
        })
        .value();
    }

    function processDocs(component, docType, docs) {
      _(docs)
        .map(function(doc) {
          return _.pick(doc, [
            'description',
            'content',
            'componentId',
            'componentName',
            'docType',
            'name',
            'params',
            'description',
            'restrict',
            'element',
            'priority',
            'usage'
          ]);
        })
        .each(function(doc) {
          if (doc.docType === 'directive') {
            //dash-case for directives
            doc.humanName = doc.name.replace(/([A-Z])/g, function($1) {
              return '-'+$1.toLowerCase();
            }); 
          } else if (doc.docType === 'readme') {
            doc.humanName = 'Overview';
          } else {
            doc.humanName = doc.name;
          }

          doc.outputPath = path.join(
            _.template(docOutputFolder, {
              component: component, doc: doc
            }),
            'index.html'
          );
          renderedDocs.push(doc);
          component.docs.push(doc);
        })
        .value();
    }
  }
};

